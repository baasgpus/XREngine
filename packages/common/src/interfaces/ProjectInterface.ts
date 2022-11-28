import { IPackageJson } from 'package-json-type'

import { ProjectPermissionInterface } from './ProjectPermissionInterface'

export type ProjectUpdateType = 'none' | 'commit' | 'tag'

export const DefaultUpdateSchedule = '0 * * * *'

export interface ProjectInterface {
  id: string
  name: string
  thumbnail: string
  repositoryPath: string
  version?: string
  engineVersion?: string
  description?: string
  settings?: string
  needsRebuild: boolean
  destinationSha?: string
  sourceRepo?: string
  sourceBranch?: string
  updateType: ProjectUpdateType
  updateSchedule?: string
  updateUserId?: string
  hasWriteAccess?: boolean
  project_permissions?: ProjectPermissionInterface[]
}

export interface ProjectPackageJsonType extends IPackageJson {
  etherealEngine: {
    version: string
  }
}
