import {
  DepthFormat,
  DepthStencilFormat,
  DepthTexture,
  RGBAFormat,
  UnsignedByteType,
  UnsignedInt248Type,
  UnsignedIntType,
  WebGLRenderer,
  WebGLRenderTarget
} from 'three'

import { defineState, getState } from '@xrengine/hyperflux'

import { World } from '../ecs/classes/World'
import { EngineRenderer } from '../renderer/WebGLRendererSystem'

export const XRRendererState = defineState({
  name: 'XRRendererState',
  initial: () => ({
    glBaseLayer: null as null | XRWebGLLayer,
    glBinding: null as null | XRWebGLLayer,
    glProjLayer: null as null | XRWebGLLayer,
    limitWithNativeFramebufferScaleFactor: false,
    animation: new WebGLAnimation()
  })
})

export default async function XRRendererSystem(world: World) {
  const { glBaseLayer, glBinding, glProjLayer, limitWithNativeFramebufferScaleFactor } = getState(XRRendererState)

  /** internals */
  let initialRenderTarget = null as WebGLRenderTarget | null

  function onSessionEnd() {
    // restore framebuffer/rendering state
    EngineRenderer.instance.renderer.setRenderTarget(initialRenderTarget)
    animation.stop()
  }

  const setSession = async (session: XRSession, renderer: WebGLRenderer) => {
    const gl = EngineRenderer.instance.renderContext

    initialRenderTarget = renderer.getRenderTarget()

    const attributes = gl.getContextAttributes()!
    if (attributes.xrCompatible !== true) {
      await gl.makeXRCompatible()
    }

    if (limitWithNativeFramebufferScaleFactor.value === true && XRWebGLLayer.getNativeFramebufferScaleFactor) {
      const nativeFramebufferScaleFactor = XRWebGLLayer.getNativeFramebufferScaleFactor(session)

      if (nativeFramebufferScaleFactor < framebufferScaleFactor) {
        framebufferScaleFactor = nativeFramebufferScaleFactor
      }
    }

    if (session.renderState.layers === undefined || renderer.capabilities.isWebGL2 === false) {
      const layerInit = {
        antialias: session.renderState.layers === undefined ? attributes.antialias : true,
        alpha: attributes.alpha,
        depth: attributes.depth,
        stencil: attributes.stencil,
        framebufferScaleFactor: framebufferScaleFactor
      }

      glBaseLayer.set(new XRWebGLLayer(session, gl, layerInit))

      session.updateRenderState({ baseLayer: glBaseLayer })

      newRenderTarget = new WebGLRenderTarget(glBaseLayer.framebufferWidth, glBaseLayer.framebufferHeight, {
        format: RGBAFormat,
        type: UnsignedByteType,
        encoding: renderer.outputEncoding,
        stencilBuffer: attributes.stencil
      })
    } else {
      let depthFormat = null
      let depthType = null
      let glDepthFormat = null

      if (attributes.depth) {
        glDepthFormat = attributes.stencil ? gl.DEPTH24_STENCIL8 : gl.DEPTH_COMPONENT24
        depthFormat = attributes.stencil ? DepthStencilFormat : DepthFormat
        depthType = attributes.stencil ? UnsignedInt248Type : UnsignedIntType
      }

      const projectionlayerInit = {
        colorFormat: gl.RGBA8,
        depthFormat: glDepthFormat,
        scaleFactor: framebufferScaleFactor
      }

      glBinding = new XRWebGLBinding(session, gl)

      glProjLayer = glBinding.createProjectionLayer(projectionlayerInit)

      session.updateRenderState({ layers: [glProjLayer] })

      newRenderTarget = new WebGLRenderTarget(glProjLayer.textureWidth, glProjLayer.textureHeight, {
        format: RGBAFormat,
        type: UnsignedByteType,
        depthTexture: new DepthTexture(
          glProjLayer.textureWidth,
          glProjLayer.textureHeight,
          depthType,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          depthFormat
        ),
        stencilBuffer: attributes.stencil,
        encoding: renderer.outputEncoding,
        samples: attributes.antialias ? 4 : 0
      })

      const renderTargetProperties = renderer.properties.get(newRenderTarget)
      renderTargetProperties.__ignoreDepthValues = glProjLayer.ignoreDepthValues
    }

    newRenderTarget.isXRRenderTarget = true // TODO Remove this when possible, see #23278

    // Set foveation to maximum.
    this.setFoveation(1.0)

    customReferenceSpace = null
    referenceSpace = await session.requestReferenceSpace(referenceSpaceType)

    animation.setContext(session)
    animation.start()
  }

  const execute = () => {}

  const cleanup = async () => {}

  return { execute, cleanup }
}
