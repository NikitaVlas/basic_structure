param(
    [string]$Root = (Split-Path -Parent $PSScriptRoot)
)

$patterns = @('TBD', 'YYYY-MM-DD', 'Describe ', 'Question:')
$files = Get-ChildItem -LiteralPath $Root -Recurse -File -Filter '*.md' |
    Where-Object {
        $_.FullName -notmatch '\\.git\\|\\tasks\\|\\docs\\questionnaires\\|\\docs\\specifications\\|\\docs\\architecture\\decisions\\' -and
        $_.Name -notin @('README.md', 'AI-SETUP.md', 'initialization-checklist.md')
    }
$matches = $files | Select-String -Pattern $patterns

if ($matches) {
    $matches | Select-Object Path, LineNumber, Line | Format-Table -AutoSize
    exit 1
}

Write-Output 'Documentation preflight passed.'
exit 0
