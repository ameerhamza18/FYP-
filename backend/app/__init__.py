"""TrustLayer backend application package.

Bootstraps the repository root into `sys.path` so the platform services
(`services.nlp`, `services.vision`, `services.url_intelligence`,
`services.threat_engine`, `services.llm`) and the `ml` package can be
imported as first-class modules, mirroring the microservice decomposition
described in the project architecture.
"""
import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parents[2]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

__all__ = ["_REPO_ROOT"]
