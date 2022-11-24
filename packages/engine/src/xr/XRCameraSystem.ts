import { ArrayCamera, Matrix4, Object3D, PerspectiveCamera, Vector3, Vector4 } from 'three'

import { getState } from '@xrengine/hyperflux'

import { Engine } from '../ecs/classes/Engine'
import { World } from '../ecs/classes/World'
import { getComponent } from '../ecs/functions/ComponentFunctions'
import { EngineRenderer } from '../renderer/WebGLRendererSystem'
import { LocalTransformComponent, TransformComponent } from '../transform/components/TransformComponent'
import { XRRendererState } from './XRRendererSystem'

const cameraL = new PerspectiveCamera()
cameraL.layers.enable(1)
cameraL.viewport = new Vector4()

const cameraR = new PerspectiveCamera()
cameraR.layers.enable(2)
cameraR.viewport = new Vector4()

const cameras = [cameraL, cameraR]

const cameraVR = new ArrayCamera()
cameraVR.layers.enable(1)
cameraVR.layers.enable(2)

const cameraLPos = new Vector3()
const cameraRPos = new Vector3()

/**
 * Assumes 2 cameras that are parallel and share an X-axis, and that
 * the cameras' projection and world matrices have already been set.
 * And that near and far planes are identical for both cameras.
 * Visualization of this technique: https://computergraphics.stackexchange.com/a/4765
 */
function setProjectionFromUnion(camera, cameraL, cameraR) {
  cameraLPos.setFromMatrixPosition(cameraL.matrixWorld)
  cameraRPos.setFromMatrixPosition(cameraR.matrixWorld)

  const ipd = cameraLPos.distanceTo(cameraRPos)

  const projL = cameraL.projectionMatrix.elements
  const projR = cameraR.projectionMatrix.elements

  // VR systems will have identical far and near planes, and
  // most likely identical top and bottom frustum extents.
  // Use the left camera for these values.
  const near = projL[14] / (projL[10] - 1)
  const far = projL[14] / (projL[10] + 1)
  const topFov = (projL[9] + 1) / projL[5]
  const bottomFov = (projL[9] - 1) / projL[5]

  const leftFov = (projL[8] - 1) / projL[0]
  const rightFov = (projR[8] + 1) / projR[0]
  const left = near * leftFov
  const right = near * rightFov

  // Calculate the new camera's position offset from the
  // left camera. xOffset should be roughly half `ipd`.
  const zOffset = ipd / (-leftFov + rightFov)
  const xOffset = zOffset * -leftFov

  // TODO: Better way to apply this offset?
  cameraL.matrixWorld.decompose(camera.position, camera.quaternion, camera.scale)
  camera.translateX(xOffset)
  camera.translateZ(zOffset)
  camera.matrixWorld.compose(camera.position, camera.quaternion, camera.scale)
  camera.matrixWorldInverse.copy(camera.matrixWorld).invert()

  // Find the union of the frustum values of the cameras and scale
  // the values so that the near plane's position does not change in world space,
  // although must now be relative to the new union camera.
  const near2 = near + zOffset
  const far2 = far + zOffset
  const left2 = left - xOffset
  const right2 = right + (ipd - xOffset)
  const top2 = ((topFov * far) / far2) * near2
  const bottom2 = ((bottomFov * far) / far2) * near2

  camera.projectionMatrix.makePerspective(left2, right2, top2, bottom2, near2, far2)
}

const updateCameraMatrix = (camera: PerspectiveCamera, parent: Object3D | null) => {
  if (!parent) {
    camera.matrixWorld.copy(camera.matrix)
  } else {
    camera.matrixWorld.multiplyMatrices(parent.matrixWorld, camera.matrix)
  }
  camera.matrixWorldInverse.copy(camera.matrixWorld).invert()
}

/**
 * Updates materials with XR depth map uniforms
 * @param world
 * @returns
 */
export default async function XRCameraSystem(world: World) {
  let _currentDepthNear = 0
  let _currentDepthFar = 0

  const updateCamera = (camera: PerspectiveCamera) => {
    const session = Engine.instance.xrFrame!.session

    cameraVR.near = cameraR.near = cameraL.near = camera.near
    cameraVR.far = cameraR.far = cameraL.far = camera.far

    if (_currentDepthNear !== cameraVR.near || _currentDepthFar !== cameraVR.far) {
      // Note that the new renderState won't apply until the next frame. See #18320

      session.updateRenderState({
        depthNear: cameraVR.near,
        depthFar: cameraVR.far
      })

      _currentDepthNear = cameraVR.near
      _currentDepthFar = cameraVR.far
    }

    const parent = camera.parent
    const cameras = cameraVR.cameras

    updateCameraMatrix(cameraVR, parent)

    for (let i = 0; i < cameras.length; i++) {
      updateCameraMatrix(cameras[i], parent)
    }

    cameraVR.matrixWorld.decompose(cameraVR.position, cameraVR.quaternion, cameraVR.scale)

    // update user camera and its children

    camera.matrix.copy(cameraVR.matrix)
    camera.matrix.decompose(camera.position, camera.quaternion, camera.scale)

    const children = camera.children

    for (let i = 0, l = children.length; i < l; i++) {
      children[i].updateMatrixWorld(true)
    }

    // update projection matrix for proper view frustum culling
    if (cameras.length === 2) {
      setProjectionFromUnion(cameraVR, cameraL, cameraR)
    } else {
      // assume single camera setup (AR)
      cameraVR.projectionMatrix.copy(cameraL.projectionMatrix)
    }
  }

  const updateXRCameraViewPose = (xrFrame: XRFrame) => {
    const pose = xrFrame.getViewerPose(referenceSpace)
    if (!pose) return

    const views = pose.views

    if (glBaseLayer !== null) {
      renderer.setRenderTargetFramebuffer(newRenderTarget, glBaseLayer.framebuffer)
      renderer.setRenderTarget(newRenderTarget)
    }

    let cameraVRNeedsUpdate = false

    // check if it's necessary to rebuild cameraVR's camera list

    if (views.length !== cameraVR.cameras.length) {
      cameraVR.cameras.length = 0
      cameraVRNeedsUpdate = true
    }

    const renderer = EngineRenderer.instance.renderer

    const { glBaseLayer, glBinding, glProjLayer } = getState(XRRendererState).value

    for (let i = 0; i < views.length; i++) {
      const view = views[i]

      let viewport = null

      if (glBaseLayer !== null) {
        viewport = glBaseLayer.getViewport(view)
      } else {
        const glSubImage = glBinding.getViewSubImage(glProjLayer, view)
        viewport = glSubImage.viewport

        // For side-by-side projection, we only produce a single texture for both eyes.
        if (i === 0) {
          renderer.setRenderTargetTextures(
            newRenderTarget,
            glSubImage.colorTexture,
            glProjLayer.ignoreDepthValues ? undefined : glSubImage.depthStencilTexture
          )

          renderer.setRenderTarget(newRenderTarget)
        }
      }

      let camera = cameras[i]

      if (camera === undefined) {
        camera = new PerspectiveCamera()
        camera.layers.enable(i)
        camera.viewport = new Vector4()
        cameras[i] = camera
      }

      camera.matrix.fromArray(view.transform.matrix)
      camera.projectionMatrix.fromArray(view.projectionMatrix)
      camera.viewport.set(viewport.x, viewport.y, viewport.width, viewport.height)

      if (i === 0) {
        cameraVR.matrix.copy(camera.matrix)
      }

      if (cameraVRNeedsUpdate === true) {
        cameraVR.cameras.push(camera)
      }
    }
  }

  const updateXRCameraTransform = (camera: PerspectiveCamera, originMatrix: Matrix4) => {
    camera.matrixWorld.multiplyMatrices(originMatrix, camera.matrix)
    camera.matrixWorldInverse.copy(camera.matrixWorld).invert()
  }

  const updateXRInput = (world = Engine.instance.currentWorld) => {
    const xrManager = EngineRenderer.instance.xrManager
    const camera = Engine.instance.currentWorld.camera as PerspectiveCamera

    /*
     * Updates the XR camera to the camera position, including updating it's world matrix
     */
    // xrManager.updateCamera(camera)
    updateCamera(camera)

    /*
     * We want to position the camera relative to the xr origin
     */
    const cameraLocalTransform = getComponent(world.cameraEntity, LocalTransformComponent)
    cameraLocalTransform.matrix.copy(camera.matrixWorld)
    cameraLocalTransform.position.copy(camera.position)
    cameraLocalTransform.rotation.copy(camera.quaternion)
    cameraLocalTransform.scale.copy(camera.scale)

    /*
     * xr cameras also have to have their world transforms updated relative to the origin, as these are used for actual rendering
     */
    const originTransform = getComponent(world.originEntity, TransformComponent)
    const cameraXR = EngineRenderer.instance.xrManager.getCamera()
    updateXRCameraTransform(cameraXR, originTransform.matrix)
    for (const camera of cameraXR.cameras) updateXRCameraTransform(camera, originTransform.matrix)
  }

  const execute = () => {
    if (!EngineRenderer.instance.xrSession) return

    updateXRInput(world)

    // Assume world.camera.layers is source of truth for all xr cameras
    const camera = Engine.instance.currentWorld.camera as PerspectiveCamera
    const xrCamera = EngineRenderer.instance.xrManager.getCamera()
    xrCamera.layers.mask = camera.layers.mask
    for (const c of xrCamera.cameras) c.layers.mask = camera.layers.mask
  }

  const cleanup = async () => {}

  return { execute, cleanup }
}
