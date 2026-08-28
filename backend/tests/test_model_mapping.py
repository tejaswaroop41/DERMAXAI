import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from core.config import settings
from core.model import _validate_checkpoint_class_order


CANONICAL_CLASSES = ['akiec', 'bcc', 'bkl', 'df', 'mel', 'nv', 'vasc']


def test_configured_class_order_is_canonical():
    assert settings.CLASSES == CANONICAL_CLASSES
    assert settings.NUM_CLASSES == len(CANONICAL_CLASSES)


def test_matching_checkpoint_class_order_is_accepted():
    _validate_checkpoint_class_order({'class_names': CANONICAL_CLASSES})


def test_mismatched_checkpoint_class_order_is_rejected():
    reversed_classes = list(reversed(CANONICAL_CLASSES))

    try:
        _validate_checkpoint_class_order({'class_names': reversed_classes})
    except RuntimeError as exc:
        assert 'class_names order does not match' in str(exc)
    else:
        raise AssertionError('Mismatched checkpoint class order was accepted')
