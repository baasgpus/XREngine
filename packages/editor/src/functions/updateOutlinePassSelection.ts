import { Engine } from '@xrengine/engine/src/ecs/classes/Engine'
import { Entity } from '@xrengine/engine/src/ecs/classes/Entity'
import { getComponent, getOptionalComponent } from '@xrengine/engine/src/ecs/functions/ComponentFunctions'
import { EngineRenderer } from '@xrengine/engine/src/renderer/WebGLRendererSystem'
import { GroupComponent } from '@xrengine/engine/src/scene/components/GroupComponent'
import { Effects } from '@xrengine/engine/src/scene/constants/PostProcessing'
import obj3dFromUuid from '@xrengine/engine/src/scene/util/obj3dFromUuid'

import { accessSelectionState } from '../services/SelectionServices'

export const updateOutlinePassSelection = (): void => {
  if (!EngineRenderer.instance.effectComposer || !EngineRenderer.instance.effectComposer[Effects.OutlineEffect]) return

  const meshes = [] as any[]
  const parentEntities = accessSelectionState().selectedParentEntities.value
  for (let i = 0; i < parentEntities.length; i++) {
    const parentEnt = parentEntities[i]
    const isUuid = typeof parentEnt === 'string'
    const group = isUuid
      ? [obj3dFromUuid(parentEnt)]
      : getOptionalComponent(parentEntities[i] as Entity, GroupComponent)
    if (group)
      for (const obj3d of group)
        obj3d?.traverse((child: any) => {
          if (child.isMesh || child.isLine || child.isSprite || child.isPoints) {
            meshes.push(child)
          }
        })
  }

  EngineRenderer.instance.effectComposer[Effects.OutlineEffect].selection.set(meshes)
}
