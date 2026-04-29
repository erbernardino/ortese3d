import trimesh


def process_scan(file_path: str) -> trimesh.Trimesh:
    """
    Imports and cleans a 3D scan mesh (STL/OBJ/PLY).
    Steps: load → keep largest component → fill holes → smooth.
    """
    loaded = trimesh.load(file_path, force="mesh")

    if isinstance(loaded, trimesh.Scene):
        meshes = list(loaded.geometry.values())
        loaded = trimesh.util.concatenate(meshes)

    # Keep only the largest connected component (removes noise)
    components = loaded.split(only_watertight=False)
    mesh = max(components, key=lambda m: len(m.vertices))

    # Fill holes
    trimesh.repair.fill_holes(mesh)

    # Light Laplacian smoothing (5 iterations)
    trimesh.smoothing.filter_laplacian(mesh, lamb=0.5, iterations=5)

    mesh.process(validate=True)
    return mesh
