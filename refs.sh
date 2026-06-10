#!/usr/bin/env bash
# refs.sh — kéo source 6 repo tham chiếu (git submodules) về references/.
# Chạy 1 LẦN sau khi clone/pull trên máy mới (không thì references/ rỗng).
#   bash refs.sh   (hoặc  ./refs.sh)
set -e
git submodule update --init --depth 1
echo "✅ references/ đã sẵn sàng (6 submodule: hermes-agent · basic-memory · open-second-brain · OmniRoute · last30days-skill · awesome-finance-skills)"
