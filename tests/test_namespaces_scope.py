import pytest

from kubepilot.core.namespaces_scope import (
    normalize_namespace_names,
    resolve_scope_namespaces,
)


def test_normalize_dedupes_and_orders_preserve():
    assert normalize_namespace_names(["dev", "kube-system", " dev "]) == ["dev", "kube-system"]


def test_normalize_rejects_invalid():
    with pytest.raises(ValueError, match="invalid"):
        normalize_namespace_names(["bad_underscore"])


def test_resolve_prefers_list_over_single():
    assert resolve_scope_namespaces("default", ["dev", "kube-system"]) == ["dev", "kube-system"]


def test_resolve_single_legacy():
    assert resolve_scope_namespaces("prod", None) == ["prod"]


def test_resolve_all_when_unset():
    assert resolve_scope_namespaces(None, None) is None


def test_resolve_empty_list_means_all():
    assert resolve_scope_namespaces(None, []) is None
