//
// Copyright © 2020, 2021 Anticrm Platform Contributors.
// Copyright © 2021 Hardcore Engineering Inc.
//
// Licensed under the Eclipse Public License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License. You may
// obtain a copy of the License at https://www.eclipse.org/legal/epl-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//
// See the License for the specific language governing permissions and
// limitations under the License.
//

import type { ServerStorage, Domain, Tx, TxCUD, Doc, Ref, Class, DocumentQuery, FindResult, FindOptions, Storage } from '@anticrm/core'
import core, { Hierarchy, DOMAIN_TX } from '@anticrm/core'
import type { FullTextAdapterFactory } from './types'
import { FullTextIndex } from './fulltext'
import { Triggers } from './triggers'

/**
 * @public
 */
export interface DbAdapter extends Storage {
  /**
   * Method called after hierarchy is ready to use.
   */
  init: (model: Tx[]) => Promise<void>
}

/**
 * @public
 */
export interface TxAdapter extends DbAdapter {
  getModel: () => Promise<Tx[]>
}

/**
 * @public
 */
export type DbAdapterFactory = (hierarchy: Hierarchy, url: string, db: string) => Promise<DbAdapter>

/**
 * @public
 */
export interface DbAdapterConfiguration {
  factory: DbAdapterFactory
  url: string
}

/**
 * @public
 */
export interface DbConfiguration {
  adapters: Record<string, DbAdapterConfiguration>
  domains: Record<string, string>
  defaultAdapter: string
  workspace: string
  fulltextAdapter: {
    factory: FullTextAdapterFactory
    url: string
  }
}

class TServerStorage implements ServerStorage {
  constructor (
    private readonly domains: Record<string, string>,
    private readonly defaultAdapter: string,
    private readonly adapters: Map<string, DbAdapter>,
    private readonly hierarchy: Hierarchy,
    private readonly triggers: Triggers,
    private readonly fulltext: FullTextIndex
  ) {
  }

  private getAdapter (domain: Domain): DbAdapter {
    const name = this.domains[domain] ?? this.defaultAdapter
    const adapter = this.adapters.get(name)
    if (adapter === undefined) {
      throw new Error('adapter not provided: ' + name)
    }
    return adapter
  }

  private routeTx (tx: Tx): Promise<void> {
    if (this.hierarchy.isDerived(tx._class, core.class.TxCUD)) {
      const txCUD = tx as TxCUD<Doc>
      const domain = this.hierarchy.getDomain(txCUD.objectClass)
      return this.getAdapter(domain).tx(txCUD)
    } else {
      throw new Error('not implemented (not derived from TxCUD)')
    }
  }

  async findAll<T extends Doc> (
    clazz: Ref<Class<T>>,
    query: DocumentQuery<T>,
    options?: FindOptions<T>
  ): Promise<FindResult<T>> {
    const domain = this.hierarchy.getDomain(clazz)
    return await this.getAdapter(domain).findAll(clazz, query, options)
  }

  async tx (tx: Tx): Promise<Tx[]> {
    // store tx
    await this.getAdapter(DOMAIN_TX).tx(tx)

    if (tx.objectSpace === core.space.Model) {
      // maintain hiearachy and triggers
      this.hierarchy.tx(tx)
      await this.triggers.tx(tx)
      return []
    } else {
      // store object
      await this.routeTx(tx)
      // invoke triggers and store derived objects
      const derived = await this.triggers.apply(tx.modifiedBy, tx)
      for (const tx of derived) {
        await this.routeTx(tx)
      }
      // index object
      await this.fulltext.tx(tx)
      // index derived objects
      for (const tx of derived) {
        await this.fulltext.tx(tx)
      }

      return derived
    }
  }
}

/**
 * @public
 */
export async function createServerStorage (conf: DbConfiguration): Promise<ServerStorage> {
  const hierarchy = new Hierarchy()
  const triggers = new Triggers()
  const adapters = new Map<string, DbAdapter>()

  for (const key in conf.adapters) {
    const adapterConf = conf.adapters[key]
    adapters.set(key, await adapterConf.factory(hierarchy, adapterConf.url, conf.workspace))
  }

  const txAdapter = adapters.get(conf.domains[DOMAIN_TX]) as TxAdapter
  if (txAdapter === undefined) {
    console.log('no txadapter found')
  }

  const model = await txAdapter.getModel()

  for (const tx of model) {
    hierarchy.tx(tx)
    await triggers.tx(tx)
  }

  for (const [, adapter] of adapters) {
    await adapter.init(model)
  }

  const fulltextAdapter = await conf.fulltextAdapter.factory(conf.fulltextAdapter.url, conf.workspace)
  const fulltext = new FullTextIndex(hierarchy, fulltextAdapter)

  return new TServerStorage(conf.domains, conf.defaultAdapter, adapters, hierarchy, triggers, fulltext)
}
