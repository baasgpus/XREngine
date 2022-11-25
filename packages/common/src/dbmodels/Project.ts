export interface ProjectInterface {
  id: string
  name: string
  thumbnail: string
  repositoryPath: string
  settings: string
  needsRebuild: boolean
  destinationSha: string
  sourceRepo: string
  sourceBranch: string
  updateType: string
  updateSchedule: string
  updateUserId: string
}
