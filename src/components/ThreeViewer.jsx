import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'

export const ThreeViewer = forwardRef(function ThreeViewer({ style }, ref) {
  const mountRef = useRef(null)
  const stateRef = useRef({})

  useImperativeHandle(ref, () => ({
    loadStlBase64(stlB64) {
      const { scene, mesh: oldMesh } = stateRef.current
      if (oldMesh) scene.remove(oldMesh)

      const raw = atob(stlB64)
      const buf = new Uint8Array(raw.length)
      for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i)

      const loader = new STLLoader()
      const geometry = loader.parse(buf.buffer)
      geometry.computeVertexNormals()

      const material = new THREE.MeshStandardMaterial({
        color: 0x88ccff,
        roughness: 0.4,
        metalness: 0.1,
        vertexColors: false,
      })

      const mesh = new THREE.Mesh(geometry, material)
      mesh.geometry.center()
      scene.add(mesh)
      stateRef.current.mesh = mesh
    },

    paintZone(zoneType) {
      stateRef.current.activePaintZone = zoneType
    },
  }))

  useEffect(() => {
    const mount = mountRef.current
    const w = mount.clientWidth || 800
    const h = mount.clientHeight || 600

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(w, h)
    renderer.setPixelRatio(window.devicePixelRatio)
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x1a1a2e)

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000)
    camera.position.set(0, 0, 200)

    const ambient = new THREE.AmbientLight(0xffffff, 0.6)
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
    dirLight.position.set(50, 100, 75)
    scene.add(ambient, dirLight)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true

    stateRef.current = { scene, camera, renderer, controls }

    let animId
    function animate() {
      animId = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    function onResize() {
      const w2 = mount.clientWidth
      const h2 = mount.clientHeight
      camera.aspect = w2 / h2
      camera.updateProjectionMatrix()
      renderer.setSize(w2, h2)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', onResize)
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
      renderer.dispose()
    }
  }, [])

  return <div ref={mountRef} style={{ width: '100%', height: '100%', ...style }} />
})
