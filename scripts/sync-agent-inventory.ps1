# Sync global Cursor skills + MCP configs into .agent-inventory (gitignored).
# Re-run after installing plugins/skills:  powershell -File ./scripts/sync-agent-inventory.ps1

$ErrorActionPreference = "Stop"
$RepoRoot = Split-Path -Parent $PSScriptRoot
$OutRoot = Join-Path $RepoRoot ".agent-inventory"
$UserHome = $env:USERPROFILE
$CursorHome = Join-Path $UserHome ".cursor"
$CodexSkills = Join-Path $UserHome ".codex\skills"
$WorkspaceMcps = Join-Path $CursorHome "projects\c-Users-kevin-Documents-GitHub-CareerCenter\mcps"
$PluginCache = Join-Path $CursorHome "plugins\cache\cursor-public"

function Ensure-Dir([string]$Path) {
    if (-not (Test-Path $Path)) { New-Item -ItemType Directory -Path $Path -Force | Out-Null }
}

function Copy-SkillTree([string]$Source, [string]$DestLabel, [string]$DestRoot) {
    if (-not (Test-Path $Source)) { return @() }
    $dest = Join-Path $DestRoot $DestLabel
    Ensure-Dir $dest
    $entries = @()
    Get-ChildItem -Path $Source -Directory -ErrorAction SilentlyContinue | ForEach-Object {
        $skillFile = Join-Path $_.FullName "SKILL.md"
        if (-not (Test-Path $skillFile)) { return }
        $target = Join-Path $dest $_.Name
        Copy-Item -Path $_.FullName -Destination $target -Recurse -Force
        $entries += [pscustomobject]@{
            Name = $_.Name
            Source = $_.FullName
            Dest = $target
            Category = $DestLabel
        }
    }
    return $entries
}

function Copy-PluginSkills([string]$PluginRoot, [string]$DestRoot) {
    $entries = @()
    if (-not (Test-Path $PluginRoot)) { return $entries }
    Get-ChildItem -Path $PluginRoot -Directory | ForEach-Object {
        $pluginName = $_.Name
        $hashDirs = Get-ChildItem -Path $_.FullName -Directory -ErrorAction SilentlyContinue
        foreach ($hashDir in $hashDirs) {
            $skillsDir = Join-Path $hashDir.FullName "skills"
            if (-not (Test-Path $skillsDir)) { continue }
            $label = "plugins/$pluginName"
            $copied = Copy-SkillTree -Source $skillsDir -DestLabel $label -DestRoot $DestRoot
            foreach ($c in $copied) { $entries += $c }
        }
    }
    return $entries
}

function Redact-McpJson([string]$Path) {
    if (-not (Test-Path $Path)) { return }
    $raw = Get-Content -Path $Path -Raw -Encoding UTF8
    $redacted = $raw -replace 'postgresql://[^"\s]+', 'postgresql://REDACTED'
    $destDir = Split-Path -Parent $Path
    Ensure-Dir $destDir
    Set-Content -Path $Path -Value $redacted -Encoding UTF8 -NoNewline
}

Write-Host "Syncing to $OutRoot ..."
if (Test-Path $OutRoot) { Remove-Item -Path $OutRoot -Recurse -Force }
Ensure-Dir $OutRoot

$skillsRoot = Join-Path $OutRoot "skills"
Ensure-Dir $skillsRoot

$allSkills = [System.Collections.Generic.List[object]]::new()
$allSkills.AddRange((Copy-SkillTree (Join-Path $CursorHome "skills") "user" $skillsRoot))
$allSkills.AddRange((Copy-SkillTree (Join-Path $CursorHome "skills-cursor") "cursor-builtin" $skillsRoot))
$allSkills.AddRange((Copy-SkillTree $CodexSkills "codex" $skillsRoot))
$allSkills.AddRange((Copy-PluginSkills $PluginCache $skillsRoot))

# MCP config
$mcpRoot = Join-Path $OutRoot "mcp"
$mcpConfig = Join-Path $mcpRoot "config"
Ensure-Dir $mcpConfig

$globalMcp = Join-Path $CursorHome "mcp.json"
if (Test-Path $globalMcp) {
    $destGlobal = Join-Path $mcpConfig "global.cursor.mcp.json"
    Copy-Item $globalMcp $destGlobal -Force
    Redact-McpJson $destGlobal
}

$pluginMcpDest = Join-Path $mcpConfig "plugins"
Ensure-Dir $pluginMcpDest
if (Test-Path $PluginCache) {
    Get-ChildItem -Path $PluginCache -Recurse -Filter "mcp.json" -File | ForEach-Object {
        $rel = $_.FullName.Substring($PluginCache.Length).TrimStart('\')
        $dest = Join-Path $pluginMcpDest ($rel -replace '\\', '_')
        Copy-Item $_.FullName $dest -Force
    }
}

# Workspace MCP descriptors (tools, metadata, instructions)
$mcpWorkspace = Join-Path $mcpRoot "workspace"
if (Test-Path $WorkspaceMcps) {
    Copy-Item -Path $WorkspaceMcps -Destination $mcpWorkspace -Recurse -Force
}

# INDEX.md
$indexPath = Join-Path $OutRoot "INDEX.md"
$generated = Get-Date -Format "yyyy-MM-dd HH:mm:ss K"
$skillLines = foreach ($s in ($allSkills | Sort-Object Category, Name)) {
    $src = $s.Source.Replace('\', '/')
    "- **$($s.Name)** ($($s.Category)) - source: ``$src``"
}
$mcpServers = @()
if (Test-Path $mcpWorkspace) {
    Get-ChildItem $mcpWorkspace -Directory | ForEach-Object {
        $toolCount = (Get-ChildItem (Join-Path $_.FullName "tools") -Filter "*.json" -ErrorAction SilentlyContinue).Count
        $mcpServers += "- **$($_.Name)** - $toolCount tool descriptor(s)"
    }
}

$index = @"
# Agent inventory (local mirror)

Generated: $generated  
Refresh: ``powershell -File ./scripts/sync-agent-inventory.ps1``

This folder is **gitignored**. It mirrors global Cursor/Codex skills and MCP configs for search and review in this repo.

## Skills ($($allSkills.Count))

$($skillLines -join "`n")

## MCP workspace servers ($($mcpServers.Count))

$($mcpServers -join "`n")

## MCP config files

- ``mcp/config/global.cursor.mcp.json`` - user-level ``~/.cursor/mcp.json`` (secrets redacted)
- ``mcp/config/plugins/`` - plugin-bundled MCP definitions
- ``mcp/workspace/`` - tool JSON + INSTRUCTIONS for this workspace

## Source roots

| Kind | Path |
|------|------|
| User skills | ``$($CursorHome -replace '\\','/')/skills`` |
| Cursor built-in skills | ``$($CursorHome -replace '\\','/')/skills-cursor`` |
| Codex skills | ``$($CodexSkills -replace '\\','/')`` |
| Plugin skills | ``$($PluginCache -replace '\\','/')/*/skills`` |
| Global MCP | ``$($CursorHome -replace '\\','/')/mcp.json`` |
| Workspace MCP cache | ``$($WorkspaceMcps -replace '\\','/')`` |
"@

Set-Content -Path $indexPath -Value $index -Encoding UTF8

Write-Host "Done. Skills: $($allSkills.Count), output: $OutRoot"
