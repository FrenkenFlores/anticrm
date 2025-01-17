//
// Copyright © 2020 Anticrm Platform Contributors.
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

import { Class, DOMAIN_MODEL, Doc, Ref } from '@hcengineering/core'
import { Builder, Model, Prop, TypeRef } from '@hcengineering/model'
import core, { TDoc } from '@hcengineering/model-core'
import { Asset, IntlString, Resource } from '@hcengineering/platform'
// Import types to prevent .svelte components to being exposed to type typescript.
import { PresentationMiddlewareCreator, PresentationMiddlewareFactory } from '@hcengineering/presentation'
import {
  ComponentPointExtension,
  CreateExtensionKind,
  DocAttributeRule,
  DocRules,
  DocCreateExtension,
  DocCreateFunction,
  ObjectSearchCategory,
  ObjectSearchFactory
} from '@hcengineering/presentation/src/types'
import { AnyComponent, ComponentExtensionId } from '@hcengineering/ui'
import presentation from './plugin'

export { presentationId } from '@hcengineering/presentation/src/plugin'
export { default } from './plugin'
export { CreateExtensionKind, DocCreateExtension, DocCreateFunction, ObjectSearchCategory, ObjectSearchFactory }

@Model(presentation.class.ObjectSearchCategory, core.class.Doc, DOMAIN_MODEL)
export class TObjectSearchCategory extends TDoc implements ObjectSearchCategory {
  label!: IntlString
  icon!: Asset

  // Query for documents with pattern
  query!: Resource<ObjectSearchFactory>
}

@Model(presentation.class.PresentationMiddlewareFactory, core.class.Doc, DOMAIN_MODEL)
export class TPresentationMiddlewareFactory extends TDoc implements PresentationMiddlewareFactory {
  createPresentationMiddleware!: Resource<PresentationMiddlewareCreator>
}

@Model(presentation.class.ComponentPointExtension, core.class.Doc, DOMAIN_MODEL)
export class TComponentPointExtension extends TDoc implements ComponentPointExtension {
  extension!: ComponentExtensionId
  component!: AnyComponent
  props!: Record<string, any>
  order!: number
}

@Model(presentation.class.DocCreateExtension, core.class.Doc, DOMAIN_MODEL)
export class TDocCreateExtension extends TDoc implements DocCreateExtension {
  @Prop(TypeRef(core.class.Class), core.string.Class)
    ofClass!: Ref<Class<Doc>>

  components!: Record<CreateExtensionKind, AnyComponent>
  apply!: Resource<DocCreateFunction>
}

@Model(presentation.class.DocRules, core.class.Doc, DOMAIN_MODEL)
export class TDocRules extends TDoc implements DocRules {
  @Prop(TypeRef(core.class.Class), core.string.Class)
    ofClass!: Ref<Class<Doc>>

  fieldRules!: DocAttributeRule[]
}

export function createModel (builder: Builder): void {
  builder.createModel(
    TObjectSearchCategory,
    TPresentationMiddlewareFactory,
    TComponentPointExtension,
    TDocCreateExtension,
    TDocRules
  )
}
