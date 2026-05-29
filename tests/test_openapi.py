# from pathlib import Path

# import yaml


# def test_openapi_yaml_loads():
#     p = Path(__file__).resolve().parents[1] / "packages" / "openapi" / "openapi.yaml"
#     data = yaml.safe_load(p.read_text())
#     assert data["openapi"].startswith("3.")
#     assert "/health" in data["paths"]
