import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import pytest

from core.config import settings
from core.model import load_model


CANONICAL_CLASSES = ['akiec', 'bcc', 'bkl', 'df', 'mel', 'nv', 'vasc']


def test_configured_class_order_is_canonical():
    assert settings.CLASSES == CANONICAL_CLASSES
    assert settings.NUM_CLASSES == len(CANONICAL_CLASSES)


def test_checkpoint_with_mismatched_class_order_is_rejected(tmp_path):
    torch = pytest.importorskip('torch')

    # Build a checkpoint whose state dict is structurally valid enough to reach
    # the class-metadata check, but whose semantic class order is wrong.
    model_state = {}
    checkpoint = {
        'model_state': model_state,
        'class_names': list(reversed(CANONICAL_CLASSES)),
    }
    path = tmp_path / 'mismatched.pth'
    torch.save(checkpoint, path)

    with pytest.raises(RuntimeError, match='class_names order does not match'):
        load_model(str(path), torch.device('cpu'))
