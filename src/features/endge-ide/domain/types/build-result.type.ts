import type { ReleaseBuildMetadata, ReleaseBuildSource } from '@/features/configurator-releases/domain/types/release-build.type'

export interface BuildResult {
  name: string
  fileFormat: 'gzip' | 'json'
  sizeBytes: number
  source: ReleaseBuildSource | null
  metadata: ReleaseBuildMetadata
}
