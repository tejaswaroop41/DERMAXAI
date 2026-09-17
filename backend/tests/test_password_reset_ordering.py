import ast
from pathlib import Path


def _forgot_password_function():
    source_path = Path(__file__).resolve().parents[1] / "app.py"
    tree = ast.parse(source_path.read_text(encoding="utf-8"))
    return next(
        node
        for node in tree.body
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef))
        and node.name == "forgot_password"
    )


def _call_line(node, function_name: str) -> int | None:
    matches = []
    for child in ast.walk(node):
        if isinstance(child, ast.Call) and isinstance(child.func, ast.Name):
            if child.func.id == function_name:
                matches.append(child.lineno)
    return min(matches) if matches else None


def test_reset_nonce_is_committed_before_password_reset_email_is_sent():
    function = _forgot_password_function()
    assignment_line = next(
        node.lineno
        for node in ast.walk(function)
        if isinstance(node, ast.Assign)
        and isinstance(node.targets[0], ast.Attribute)
        and node.targets[0].attr == "password_reset_nonce_hash"
        and isinstance(node.value, ast.Name)
        and node.value.id == "nonce_hash"
    )
    commit_lines = [
        node.lineno
        for node in ast.walk(function)
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute)
        and node.func.attr == "commit"
        and isinstance(node.func.value, ast.Name)
        and node.func.value.id == "db"
    ]
    send_line = _call_line(function, "send_password_reset_email")

    assert send_line is not None
    assert any(assignment_line < line < send_line for line in commit_lines), (
        "The reset nonce must be committed before the email is sent"
    )


def test_failed_email_cleanup_is_scoped_to_the_nonce_created_by_that_request():
    source_path = Path(__file__).resolve().parents[1] / "app.py"
    source = source_path.read_text(encoding="utf-8")

    assert source.count("User.password_reset_nonce_hash == nonce_hash") >= 2
    assert "{User.password_reset_nonce_hash: None}" in source
