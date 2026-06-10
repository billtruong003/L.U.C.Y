# refs.ps1 — kéo source 6 repo tham chiếu (git submodules) về references/.
# Chạy 1 LẦN sau khi clone/pull trên máy mới (không thì references/ rỗng).
#   PowerShell:  .\refs.ps1
git submodule update --init --depth 1
Write-Host "✅ references/ đã sẵn sàng (6 submodule: hermes-agent · basic-memory · open-second-brain · OmniRoute · last30days-skill · awesome-finance-skills)"
