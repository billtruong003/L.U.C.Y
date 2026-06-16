#!/usr/bin/env bash
# Wrapper chạy auto-build.py với ENV đúng (OPUS) + log xoay vòng
set -euo pipefail

REPO="/root/lucy"
LOG="${REPO}/auto-build.log"
rm -f "${REPO}/.autobuild-stop"   # FIX: xoá stop-flag cũ kẻo run thành no-op (bug 05:25)
export AUTOBUILD_MODEL="${AUTOBUILD_MODEL:-opus}"   # chủ nhân giữ opus
export AUTOBUILD_GROUP="${AUTOBUILD_GROUP:-1}"   # group mode: 1 nhóm/phase mỗi vòng
export AUTOBUILD_MAX_ITERS="${AUTOBUILD_MAX_ITERS:-3}"   # cho override từ ngoài
export AUTOBUILD_TIMEOUT="${AUTOBUILD_TIMEOUT:-3000}"
export LUCY_VAULT="${REPO}/lucy-vault"
export LUCY_PERSONA="${REPO}/bridge/persona.md"

# Xoay log nếu > 50MB
if [[ -f "${LOG}" && $(stat -c%s "${LOG}") -gt 52428800 ]]; then
  mv "${LOG}" "${LOG}.$(date +%Y%m%d-%H%M%S)"
fi

cd "${REPO}"
exec /usr/bin/python3 "${REPO}/auto-build.py" >> "${LOG}" 2>&1
