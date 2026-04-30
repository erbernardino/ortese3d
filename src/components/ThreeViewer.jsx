import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js'
import { ViewHelper } from 'three/examples/jsm/helpers/ViewHelper.js'

export const ThreeViewer = forwardRef(function ThreeViewer({ style, onSculptCommit }, ref) {
  const mountRef = useRef(null)
  const stateRef = useRef({})
  const sculptRef = useRef({
    active: false, radius: 8, strength: 0.5,
    mode: 'push', symmetry: 'none',
  })

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

    setSculptMode({ active, radius, strength, mode, symmetry }) {
      sculptRef.current.active = !!active
      if (radius != null) sculptRef.current.radius = radius
      if (strength != null) sculptRef.current.strength = strength
      if (mode) sculptRef.current.mode = mode
      if (symmetry) sculptRef.current.symmetry = symmetry
      const { controls } = stateRef.current
      if (controls) controls.enabled = !active
    },

    applySuggestedZones(zones, { maxDisplacementMm = 6.0 } = {}) {
      const { mesh } = stateRef.current
      if (!mesh || !zones?.length) return

      const geo = mesh.geometry
      const positions = geo.attributes.position
      const normals = geo.attributes.normal

      const bbox = new THREE.Box3().setFromObject(mesh)
      const size = new THREE.Vector3()
      bbox.getSize(size)
      const half = size.clone().multiplyScalar(0.5)
      const center = new THREE.Vector3()
      bbox.getCenter(center)

      for (const z of zones) {
        if (z.type === 'neutral') continue
        const sign = z.type === 'pressure' ? -1 : +1
        // converte posição normalizada para coords locais do mesh
        const target = new THREE.Vector3(
          z.position.x * half.x,
          z.position.y * half.y,
          z.position.z * half.z,
        )
        const r = z.radius_mm
        const intensity = (z.intensity ?? 1) * maxDisplacementMm

        for (let i = 0; i < positions.count; i++) {
          const dx = positions.getX(i) - target.x
          const dy = positions.getY(i) - target.y
          const dz = positions.getZ(i) - target.z
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz)
          if (d > r) continue
          const w = (1 - d / r) ** 2
          const move = sign * intensity * w
          positions.setX(i, positions.getX(i) + normals.getX(i) * move)
          positions.setY(i, positions.getY(i) + normals.getY(i) * move)
          positions.setZ(i, positions.getZ(i) + normals.getZ(i) * move)
        }
      }
      positions.needsUpdate = true
      geo.computeVertexNormals()
    },

    setAsymmetryHint(side) {
      const { scene, mesh, asymmetryGroup } = stateRef.current
      if (asymmetryGroup) {
        scene.remove(asymmetryGroup)
        asymmetryGroup.traverse(o => {
          if (o.geometry) o.geometry.dispose()
          if (o.material) o.material.dispose()
        })
      }
      if (!side || !mesh) {
        stateRef.current.asymmetryGroup = null
        return
      }
      const bbox = new THREE.Box3().setFromObject(mesh)
      const size = new THREE.Vector3()
      bbox.getSize(size)
      const half = size.clone().multiplyScalar(0.5)
      const center = new THREE.Vector3()
      bbox.getCenter(center)

      // posterior do lado afetado: -x, ±y conforme side, z médio-alto
      const ySign = side === 'right' ? +1 : -1
      const pos = new THREE.Vector3(
        center.x + (-0.55) * half.x,
        center.y + ySign * 0.7 * half.y,
        center.z + 0.3 * half.z,
      )
      const radius = Math.max(half.x, half.y) * 0.22

      const group = new THREE.Group()
      const sphereGeo = new THREE.SphereGeometry(radius, 24, 18)
      const mat = new THREE.MeshStandardMaterial({
        color: 0xfc8181, transparent: true, opacity: 0.45,
        emissive: 0xfc8181, emissiveIntensity: 0.4,
      })
      const m = new THREE.Mesh(sphereGeo, mat)
      m.position.copy(pos)
      group.add(m)

      // Sprite com label "Lado plano"
      const c = document.createElement('canvas')
      c.width = 256; c.height = 64
      const ctx = c.getContext('2d')
      ctx.fillStyle = 'rgba(252,129,129,0.9)'
      ctx.fillRect(0, 0, 256, 64)
      ctx.font = 'bold 28px sans-serif'
      ctx.fillStyle = 'white'
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('🚩 Lado plano', 128, 32)
      const tex = new THREE.CanvasTexture(c)
      const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true })
      const sprite = new THREE.Sprite(spriteMat)
      sprite.scale.set(40, 10, 1)
      sprite.position.copy(pos).add(new THREE.Vector3(0, 0, radius * 1.3))
      group.add(sprite)

      scene.add(group)
      stateRef.current.asymmetryGroup = group
    },

    setSuggestionZones(zones) {
      const { scene, mesh, suggestionGroup } = stateRef.current
      if (suggestionGroup) {
        scene.remove(suggestionGroup)
        suggestionGroup.traverse(o => {
          if (o.geometry) o.geometry.dispose()
          if (o.material) o.material.dispose()
        })
      }
      if (!zones || !zones.length || !mesh) {
        stateRef.current.suggestionGroup = null
        return
      }

      const COLORS = { pressure: 0xfc8181, relief: 0x63b3ed, neutral: 0xa0aec0 }
      const group = new THREE.Group()
      const bbox = new THREE.Box3().setFromObject(mesh)
      const size = new THREE.Vector3()
      bbox.getSize(size)
      const half = size.clone().multiplyScalar(0.5)
      const center = new THREE.Vector3()
      bbox.getCenter(center)

      for (const z of zones) {
        const pos = new THREE.Vector3(
          center.x + z.position.x * half.x,
          center.y + z.position.y * half.y,
          center.z + z.position.z * half.z,
        )
        const sphereGeo = new THREE.SphereGeometry(z.radius_mm * 0.6, 16, 12)
        const color = COLORS[z.type] ?? 0xffffff
        const mat = new THREE.MeshStandardMaterial({
          color, transparent: true, opacity: 0.55,
          emissive: color, emissiveIntensity: 0.25 * (z.intensity ?? 1),
        })
        const m = new THREE.Mesh(sphereGeo, mat)
        m.position.copy(pos)
        group.add(m)
      }
      scene.add(group)
      stateRef.current.suggestionGroup = group
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

    setView(preset) {
      const { camera, controls, mesh } = stateRef.current
      if (!camera || !controls) return
      // Distância adaptada ao tamanho do mesh (ou fallback 200)
      let dist = 200
      if (mesh) {
        const box = new THREE.Box3().setFromObject(mesh)
        const size = new THREE.Vector3()
        box.getSize(size)
        dist = Math.max(size.x, size.y, size.z) * 2.4
      }
      const PRESETS = {
        front:  [+dist, 0, 0],
        back:   [-dist, 0, 0],
        left:   [0, +dist, 0],
        right:  [0, -dist, 0],
        top:    [0, 0, +dist],
        bottom: [0, 0, -dist],
        iso:    [+dist * 0.7, -dist * 0.7, +dist * 0.7],
      }
      const p = PRESETS[preset] ?? PRESETS.iso
      camera.position.set(p[0], p[1], p[2])
      controls.target.set(0, 0, 0)
      camera.up.set(0, 0, 1)             // eixo Z é topo no nosso modelo
      controls.update()
    },
  }))

  useEffect(() => {
    const mount = mountRef.current
    const w = mount.clientWidth || 800
    const h = mount.clientHeight || 600

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(w, h)
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.autoClear = false               // necessário pra ViewHelper
    mount.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x1a1a2e)

    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 1000)
    camera.up.set(0, 0, 1)               // Z é topo no modelo gerado
    camera.position.set(200, -150, 120)  // vista isométrica padrão

    const ambient = new THREE.AmbientLight(0xffffff, 0.6)
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8)
    dirLight.position.set(50, 100, 75)
    scene.add(ambient, dirLight)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true

    // Gizmo de eixos no canto inferior direito (clicável)
    const viewHelper = new ViewHelper(camera, renderer.domElement)
    viewHelper.controls = controls
    viewHelper.controls.center = controls.target
    const helperContainer = document.createElement('div')
    Object.assign(helperContainer.style, {
      position: 'absolute', right: '8px', bottom: '8px',
      width: '128px', height: '128px', pointerEvents: 'auto',
    })
    mount.appendChild(helperContainer)
    helperContainer.addEventListener('pointerup', e => viewHelper.handleClick(e))
    const clock = new THREE.Clock()

    const raycaster = new THREE.Raycaster()
    const pointerNDC = new THREE.Vector2()
    let pointerDown = false

    // Estado do modo grab (capturado no pointerdown)
    let grabState = null

    function getCanvasPointer(e) {
      const rect = renderer.domElement.getBoundingClientRect()
      pointerNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      pointerNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    }

    function applyAtPoint(localPoint) {
      const { mesh } = stateRef.current
      const geo = mesh.geometry
      const positions = geo.attributes.position
      const normals = geo.attributes.normal
      const { radius, strength, mode } = sculptRef.current

      // Coleta vértices no raio (uma passada)
      const insideIdx = []
      let cx = 0, cy = 0, cz = 0
      for (let i = 0; i < positions.count; i++) {
        const dx = positions.getX(i) - localPoint.x
        const dy = positions.getY(i) - localPoint.y
        const dz = positions.getZ(i) - localPoint.z
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz)
        if (d > radius) continue
        insideIdx.push([i, d])
        cx += positions.getX(i); cy += positions.getY(i); cz += positions.getZ(i)
      }
      if (!insideIdx.length) return
      cx /= insideIdx.length; cy /= insideIdx.length; cz /= insideIdx.length

      const sign = mode === 'pull' ? -1 : 1

      for (const [i, d] of insideIdx) {
        const w = (1 - d / radius) ** 2
        const vx = positions.getX(i)
        const vy = positions.getY(i)
        const vz = positions.getZ(i)

        if (mode === 'smooth') {
          // Move o vértice em direção ao centroide local — relaxa rugosidades
          positions.setX(i, vx + (cx - vx) * strength * w * 0.5)
          positions.setY(i, vy + (cy - vy) * strength * w * 0.5)
          positions.setZ(i, vz + (cz - vz) * strength * w * 0.5)
        } else {
          // push / pull: move ao longo da normal local
          const nx = normals.getX(i)
          const ny = normals.getY(i)
          const nz = normals.getZ(i)
          positions.setX(i, vx + nx * strength * w * sign)
          positions.setY(i, vy + ny * strength * w * sign)
          positions.setZ(i, vz + nz * strength * w * sign)
        }
      }
    }

    function applySculptStroke(e) {
      const { mesh } = stateRef.current
      if (!mesh) return
      getCanvasPointer(e)
      raycaster.setFromCamera(pointerNDC, camera)
      const hits = raycaster.intersectObject(mesh)
      if (!hits.length) return
      const localPoint = mesh.worldToLocal(hits[0].point.clone())

      applyAtPoint(localPoint)

      const sym = sculptRef.current.symmetry
      if (sym && sym !== 'none') {
        const mirror = localPoint.clone()
        if (sym === 'x') mirror.x *= -1
        if (sym === 'y') mirror.y *= -1
        if (sym === 'z') mirror.z *= -1
        applyAtPoint(mirror)
      }

      mesh.geometry.attributes.position.needsUpdate = true
      mesh.geometry.computeVertexNormals()
    }

    function startGrab(e) {
      const { mesh } = stateRef.current
      if (!mesh) return null
      getCanvasPointer(e)
      raycaster.setFromCamera(pointerNDC, camera)
      const hits = raycaster.intersectObject(mesh)
      if (!hits.length) return null

      const hitWorld = hits[0].point.clone()
      // Plano paralelo à câmera no ponto de hit — drag continua mesmo
      // se o cursor sair da malha
      const plane = new THREE.Plane(
        camera.getWorldDirection(new THREE.Vector3()).negate(),
        0,
      )
      plane.constant = -plane.normal.dot(hitWorld)

      const local = mesh.worldToLocal(hitWorld.clone())
      const { radius } = sculptRef.current
      const positions = mesh.geometry.attributes.position
      const indices = []
      const original = []
      const weights = []
      for (let i = 0; i < positions.count; i++) {
        const dx = positions.getX(i) - local.x
        const dy = positions.getY(i) - local.y
        const dz = positions.getZ(i) - local.z
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz)
        if (d > radius) continue
        indices.push(i)
        original.push(positions.getX(i), positions.getY(i), positions.getZ(i))
        weights.push((1 - d / radius) ** 2)
      }
      return { plane, anchorWorld: hitWorld, indices, original, weights }
    }

    function applyGrabMove(e) {
      const { mesh } = stateRef.current
      if (!mesh || !grabState) return
      getCanvasPointer(e)
      raycaster.setFromCamera(pointerNDC, camera)
      const newWorld = new THREE.Vector3()
      const ok = raycaster.ray.intersectPlane(grabState.plane, newWorld)
      if (!ok) return

      // Delta em world → converte para local space
      const deltaWorld = newWorld.clone().sub(grabState.anchorWorld)
      const inv = new THREE.Matrix4().copy(mesh.matrixWorld).invert()
      // Aplica só rotação/escala (não translação) no delta
      const m3 = new THREE.Matrix3().setFromMatrix4(inv)
      const deltaLocal = deltaWorld.clone().applyMatrix3(m3)

      const positions = mesh.geometry.attributes.position
      const { strength } = sculptRef.current
      for (let k = 0; k < grabState.indices.length; k++) {
        const i = grabState.indices[k]
        const ox = grabState.original[k * 3]
        const oy = grabState.original[k * 3 + 1]
        const oz = grabState.original[k * 3 + 2]
        const w = grabState.weights[k] * strength
        positions.setX(i, ox + deltaLocal.x * w)
        positions.setY(i, oy + deltaLocal.y * w)
        positions.setZ(i, oz + deltaLocal.z * w)
      }
      positions.needsUpdate = true
      mesh.geometry.computeVertexNormals()
    }

    function onPointerDown(e) {
      if (!sculptRef.current.active) return
      pointerDown = true
      if (sculptRef.current.mode === 'grab') {
        grabState = startGrab(e)
      } else {
        applySculptStroke(e)
      }
    }
    function onPointerMove(e) {
      if (!sculptRef.current.active || !pointerDown) return
      if (sculptRef.current.mode === 'grab') {
        applyGrabMove(e)
      } else {
        applySculptStroke(e)
      }
    }
    function onPointerUp() {
      if (!sculptRef.current.active) return
      pointerDown = false
      grabState = null
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
      const dt = clock.getDelta()
      if (viewHelper.animating) viewHelper.update(dt)
      controls.update()
      renderer.clear()
      renderer.render(scene, camera)
      viewHelper.render(renderer)
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
