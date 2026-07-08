export const GITHUB_LATEST_RELEASE_API_URL =
  'https://api.github.com/repos/stechdrive/csp-paperback/releases/latest'

interface GitHubLatestRelease {
  tag_name?: unknown
}

export interface DesktopUpdateInfo {
  currentVersion: string
  latestVersion: string
  hasUpdate: boolean
}

function normalizeVersion(version: string): string | null {
  const trimmed = version.trim().replace(/^v/i, '')
  return /^\d+\.\d+\.\d+$/.test(trimmed) ? trimmed : null
}

export function compareSemver(a: string, b: string): number {
  const normalizedA = normalizeVersion(a)
  const normalizedB = normalizeVersion(b)
  if (!normalizedA || !normalizedB) {
    throw new Error(`Invalid semver comparison: ${a} / ${b}`)
  }

  const partsA = normalizedA.split('.').map(Number)
  const partsB = normalizedB.split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    if (partsA[i] !== partsB[i]) return partsA[i] > partsB[i] ? 1 : -1
  }
  return 0
}

export async function checkDesktopUpdate(): Promise<DesktopUpdateInfo> {
  const response = await fetch(GITHUB_LATEST_RELEASE_API_URL, {
    headers: {
      Accept: 'application/vnd.github+json',
    },
  })
  if (!response.ok) {
    throw new Error(`GitHub Releases API error: ${response.status}`)
  }

  const release = await response.json() as GitHubLatestRelease
  if (typeof release.tag_name !== 'string') {
    throw new Error('GitHub Releases API response is missing tag_name')
  }

  const latestVersion = normalizeVersion(release.tag_name)
  const currentVersion = normalizeVersion(__APP_VERSION__)
  if (!latestVersion || !currentVersion) {
    throw new Error(`Invalid release version: ${release.tag_name}`)
  }

  return {
    currentVersion,
    latestVersion,
    hasUpdate: compareSemver(latestVersion, currentVersion) > 0,
  }
}
