import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js'

export const ThreeViewer = forwardRef(function ThreeViewer({ style, onSculptCommit }, ref) {
  const mountRef = useRef(null)
  const stateRef = useRef({})
  const sculptRef = useRef({ active: false, radius: 8, strength: 0.5, mode: 'push' })

  useImperativeHandle(ref, () => ({
    loadStlBase64(stlB64) {
      const { scene, mesh: oldMesh } = stateRef.current
      if (oldMesh) scene.remove(oldMesh)

      const raw = atob(stlB64)
      const buf = new Uint8Array(raw.length)
      for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i)

      const loader = new STLLoader()
      const geometry = loader.parse(buf.buffer)
      // STL não compartilha vértices entre faces; mesclar para sculpt suave
      const merged = mergeVerticesByPosition(geometry)
      merged.computeVertexNormals()

      const material = new THREE.MeshStandardMaterial({
        color: 0x88ccff, roughness: 0.4, metalness: 0.1, vertexColors: false,
      })

      const mesh = new THREE.Mesh(merged, material)
      mesh.geometry.center()
      scene.add(mesh)
      stateRef.current.mesh = mesh
    },

    paintZone(zoneType) {
      stateRef.current.activePaintZone = zoneType
    },

    setSculptMode({ active, radius, strength, mode }) {
      sculptRef.current.active = !!active
      if (radius != null) sculptRef.current.radius = radius
      if (strength != null) sculptRef.current.strength = strength
      if (mode) sculptRef.current.mode = mode
      const { controls } = stateRef.current
      if (controls) controls.enabled = !active
    },

    exportStlBase64() {
      const { mesh } = stateRef.current
      if (!mesh) return null
      const exporter = new STLExporter()
      const arr = exporter.parse(mesh, { binary: true })
      let bin = ''
      const u8 = new Uint8Array(arr.buffer ?? arr)
      for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i])
      return btoa(bin)
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

    const raycaster = new THREE.Raycaster()
    const pointerNDC = new THREE.Vector2()
    let pointerDown = false

    function getCanvasPointer(e) {
      const rect = renderer.domElement.getBoundingClientRect()
      pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    }

    function applySculptStroke(e) {
      const { mesh } = stateRef.current
      if (!mesh) return
      getCanvasPointer(e)
      raycaster.setFromCamera(pointerNDC, camera)
      const hits = raycaster.intersectObject(mesh)
      if (!hits.length) return
      const hit = hits[0]
      const localPoint = mesh.worldToLocal(hit.point.clone())

      const geo = mesh.geometry
      const positions = geo.attributes.position
      const normals = geo.attributes.normal
      const { radius, strength, mode } = sculptRef.current
      const sign = mode === 'pull' ? -1 : 1

      for (let i = 0; i < positions.count; i++) {
        const vx = positions.getX(i)
        const vy = positions.getY(i)
        const vz = positions.getZ(i)
        const dx = vx - localPoint.x
        const dy = vy - localPoint.y
        const dz = vz - localPoint.z
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz)
        if (d > radius) continue
        const falloff = 1 - d / radius
        const w = falloff * falloff
        const nx = normals.getX(i)
        const ny = normals.getY(i)
        const nz = normals.getZ(i)
        positions.setX(i, vx + nx * strength * w * sign)
        positions.setY(i, vy + ny * strength * w * sign)
        positions.setZ(i, vz + nz * strength * w * sign)
      }
      positions.needsUpdate = true
      geo.computeVertexNormals()
    }

    function onPointerDown(e) {
      if (!sculptRef.current.active) return
      pointerDown = true
      applySculptStroke(e)
    }
    function onPointerMove(e) {
      if (!sculptRef.current.active || !pointerDown) return
      applySculptStroke(e)
    }
    function onPointerUp() {
      if (!sculptRef.current.active) return
      pointerDown = false
      onSculptCommit?.()
    }

    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    renderer.domElement.addEventListener('pointermove', onPointerMove)
    renderer.domElement.addEventListener('pointerup', onPointerUp)
    renderer.domElement.addEventListener('pointerleave', onPointerUp)

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
      renderer.domElement.removeEventListener('pointerdown', onPointerDown)
      renderer.domElement.removeEventListener('pointermove', onPointerMove)
      renderer.domElement.removeEventListener('pointerup', onPointerUp)
      renderer.domElement.removeEventListener('pointerleave', onPointerUp)
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
      renderer.dispose()
    }
  }, [])

  return <div ref={mountRef} style={{ width: '100%', height: '100%', ...style }} />
})

// Mescla vértices duplicados por posição (STLs não-indexados → indexed) — necessário
// para que o sculpt afete vizinhos em vez de mover só uma face isolada.
function mergeVerticesByPosition(geometry) {
  const pos = geometry.attributes.position
  const map = new Map()
  const newPositions = []
  const indices = []
  const KEY_PRECISION = 1000  // 0.001mm tolerance

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const k = `${Math.round(x * KEY_PRECISION)}|${Math.round(y * KEY_PRECISION)}|${Math.round(z * KEY_PRECISION)}`
    let idx = map.get(k)
    if (idx === undefined) {
      idx = newPositions.length / 3
      newPositions.push(x, y, z)
      map.set(k, idx)
    }
    indices.push(idx)
  }

  const merged = new THREE.BufferGeometry()
  merged.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3))
  merged.setIndex(indices)
  return merged
}
