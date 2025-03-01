import React, { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import ProjectDrawer from '@xrengine/client-core/src/admin/components/Project/ProjectDrawer'
import { ProjectService } from '@xrengine/client-core/src/common/services/ProjectService'
import { useRouter } from '@xrengine/client-core/src/common/services/RouterService'
import { useAuthState } from '@xrengine/client-core/src/user/services/AuthService'
import { ProjectInterface } from '@xrengine/common/src/interfaces/ProjectInterface'
import multiLogger from '@xrengine/common/src/logger'
import { Engine } from '@xrengine/engine/src/ecs/classes/Engine'
import { initSystems } from '@xrengine/engine/src/ecs/functions/SystemFunctions'
import { dispatchAction } from '@xrengine/hyperflux'

import {
  ArrowRightRounded,
  Check,
  Clear,
  Delete,
  Download,
  DownloadDone,
  FilterList,
  Group,
  Link,
  LinkOff,
  Search,
  Settings,
  Upload
} from '@mui/icons-material'
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  CircularProgress,
  IconButton,
  InputBase,
  Menu,
  MenuItem,
  Paper
} from '@mui/material'

import { getProjects } from '../../functions/projectFunctions'
import { EditorAction } from '../../services/EditorServices'
import { Button, MediumButton } from '../inputs/Button'
import { CreateProjectDialog } from './CreateProjectDialog'
import { DeleteDialog } from './DeleteDialog'
import { EditPermissionsDialog } from './EditPermissionsDialog'
import { GithubRepoDialog } from './GithubRepoDialog'
import styles from './styles.module.scss'

const logger = multiLogger.child({ component: 'editor:ProjectsPage' })

function sortAlphabetical(a, b) {
  if (a > b) return -1
  if (b > a) return 1
  return 0
}

const OfficialProjectData = [
  {
    id: '1570ae00-889a-11ec-886e-b126f7590685',
    name: 'Development Test Suite',
    repositoryPath: 'https://github.com/XRFoundation/XREngine-development-test-suite',
    thumbnail: '/static/etherealengine.png',
    description: 'Assets and tests for xrengine core development',
    needsRebuild: true
  },
  {
    id: '1570ae01-889a-11ec-886e-b126f7590685',
    name: 'Translations',
    repositoryPath: 'https://github.com/XRFoundation/XREngine-i18n',
    thumbnail: '/static/etherealengine.png',
    description: 'Complete language translations in over 100 languages.',
    needsRebuild: true
  },
  {
    id: '1570ae02-889a-11ec-886e-b126f7590685',
    name: 'Test Bot',
    repositoryPath: 'https://github.com/XRFoundation/XREngine-Bot',
    thumbnail: '/static/etherealengine.png',
    description: 'A test bot using puppeteer',
    needsRebuild: true
  },
  {
    id: '1570ae11-889a-11ec-886e-b126f7590685',
    name: 'Maps',
    repositoryPath: 'https://github.com/XRFoundation/XREngine-Project-Maps',
    thumbnail: '/static/etherealengine.png',
    description: 'Procedurally generated map tiles using geojson data with mapbox and turf.js',
    needsRebuild: true
  },
  {
    id: '1570ae12-889a-11ec-886e-b126f7590685',
    name: 'Inventory',
    repositoryPath: 'https://github.com/XRFoundation/XREngine-Project-Inventory',
    thumbnail: '/static/etherealengine.png',
    description:
      'Item inventory, trade & virtual currency. Allow your users to use a database, IPFS, DID or blockchain backed item storage for equippables, wearables and tradable items.',
    needsRebuild: true
  },
  {
    id: '1570ae14-889a-11ec-886e-b126f7590685',
    name: 'Digital Beings',
    repositoryPath: 'https://github.com/XRFoundation/XREngine-Project-Digital-Beings',
    thumbnail: '/static/etherealengine.png',
    description: 'Enhance your virtual worlds with GPT-3 backed AI agents!',
    needsRebuild: true
  },
  {
    id: '1570ae15-889a-11ec-886e-b126f7590685',
    name: 'Harmony Chat',
    repositoryPath: 'https://github.com/XRFoundation/Harmony-Chat',
    thumbnail: '/static/etherealengine.png',
    description:
      'An elegant and minimalist messenger client with group text, audio, video and screensharing capabilities.',
    needsRebuild: true
  }
]

const ProjectUpdateSystemInjection = {
  uuid: 'core.admin.ProjectUpdateSystem',
  type: 'PRE_RENDER',
  systemLoader: () => import('@xrengine/client-core/src/systems/ProjectUpdateSystem')
} as const

const CommunityProjectData = [] as any

const ProjectExpansionList = (props: React.PropsWithChildren<{ id: string; summary: string }>) => {
  return (
    <Accordion classes={{ root: styles.expansionList }} disableGutters defaultExpanded>
      <AccordionSummary
        id={props.id}
        classes={{
          root: styles.expansionSummary,
          content: styles.expansionSummaryContent,
          expanded: styles.expansionSummaryExpanded
        }}
      >
        <IconButton aria-label="menu" disableRipple>
          <ArrowRightRounded />
        </IconButton>
        <h3>{props.summary}</h3>
      </AccordionSummary>
      <AccordionDetails classes={{ root: styles.expansionDetail }}>{props.children}</AccordionDetails>
    </Accordion>
  )
}

const ProjectsPage = () => {
  const [installedProjects, setInstalledProjects] = useState<ProjectInterface[]>([]) // constant projects initialized with an empty array.
  const [officialProjects, setOfficialProjects] = useState<ProjectInterface[]>([])
  const [communityProjects, setCommunityProjects] = useState<ProjectInterface[]>([])
  const [activeProject, setActiveProject] = useState<ProjectInterface | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [query, setQuery] = useState('')
  const [filterAnchorEl, setFilterAnchorEl] = useState<any>(null)
  const [projectAnchorEl, setProjectAnchorEl] = useState<any>(null)
  const [filter, setFilter] = useState({ installed: false, official: true, community: true })
  const [isCreateDialogOpen, setCreateDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [updatingProject, setUpdatingProject] = useState(false)
  const [uploadingProject, setUploadingProject] = useState(false)
  const [repoLinkDialogOpen, setRepoLinkDialogOpen] = useState(false)
  const [editPermissionsDialogOpen, setPermissionsDialogOpen] = useState(false)
  const [projectDrawerOpen, setProjectDrawerOpen] = useState(false)
  const [changeDestination, setChangeDestination] = useState(false)

  const authState = useAuthState()
  const authUser = authState.authUser
  const user = authState.user

  const ownsActiveProject =
    activeProject?.project_permissions &&
    activeProject.project_permissions.find(
      (permission) => permission.userId === user.value.id && permission.type === 'owner'
    )

  const { t } = useTranslation()
  const route = useRouter()

  const fetchInstalledProjects = async () => {
    setLoading(true)
    try {
      const data = await getProjects()
      setInstalledProjects(data.sort(sortAlphabetical) ?? [])
      if (activeProject) setActiveProject(data.find((item) => item.id === activeProject.id) as ProjectInterface | null)
    } catch (error) {
      logger.error(error)
      setError(error)
    }
    setLoading(false)
  }

  const fetchOfficialProjects = async (query?: string) => {
    setLoading(true)
    try {
      const data = await (query
        ? OfficialProjectData.filter((p) => p.name.includes(query) || p.description.includes(query))
        : OfficialProjectData)

      setOfficialProjects((data.sort(sortAlphabetical) as ProjectInterface[]) ?? [])
    } catch (error) {
      logger.error(error)
      setError(error)
    }
    setLoading(false)
  }

  const fetchCommunityProjects = async (query?: string) => {
    setLoading(true)
    try {
      const data = await (query
        ? CommunityProjectData.filter((p) => p.name.includes(query) || p.description.includes(query))
        : CommunityProjectData)

      setCommunityProjects(data.sort(sortAlphabetical) ?? [])
    } catch (error) {
      logger.error(error)
      setError(error)
    }
    setLoading(false)
  }

  useEffect(() => {
    initSystems(Engine.instance.currentWorld, [ProjectUpdateSystemInjection])
  }, [])

  useEffect(() => {
    if (!authUser || !user) return
    if (authUser.accessToken.value == null || authUser.accessToken.value.length <= 0 || user.id.value == null) return

    fetchInstalledProjects()
    fetchOfficialProjects()
    fetchCommunityProjects()
  }, [authUser.accessToken])

  // TODO: Implement tutorial #7257
  const openTutorial = () => {
    logger.info('Implement Tutorial...')
  }

  const onClickExisting = (event, project) => {
    event.preventDefault()
    if (!isInstalled(project)) return

    dispatchAction(EditorAction.sceneChanged({ sceneName: null }))
    dispatchAction(EditorAction.projectChanged({ projectName: project.name }))
    route(`/editor/${project.name}`)
  }

  const onCreateProject = async (name) => {
    await ProjectService.createProject(name)
    await fetchInstalledProjects()
  }

  const onCreatePermission = async (userInviteCode: string, projectId: string) => {
    await ProjectService.createPermission(userInviteCode, projectId)
    await fetchInstalledProjects()
  }

  const onPatchPermission = async (id: string, type: string) => {
    await ProjectService.patchPermission(id, type)
    await fetchInstalledProjects()
  }

  const onRemovePermission = async (id: string) => {
    await ProjectService.removePermission(id)
    await fetchInstalledProjects()
  }

  const openDeleteConfirm = () => setDeleteDialogOpen(true)
  const closeDeleteConfirm = () => setDeleteDialogOpen(false)
  const openCreateDialog = () => setCreateDialogOpen(true)
  const closeCreateDialog = () => setCreateDialogOpen(false)
  const closeRepoLinkDialog = () => setRepoLinkDialogOpen(false)
  const openEditPermissionsDialog = () => setPermissionsDialogOpen(true)
  const closeEditPermissionsDialog = () => setPermissionsDialogOpen(false)

  const deleteProject = async () => {
    closeDeleteConfirm()

    setUpdatingProject(true)
    if (activeProject) {
      try {
        const proj = installedProjects.find((proj) => proj.id === activeProject.id)!
        await ProjectService.removeProject(proj.id)
        await fetchInstalledProjects()
      } catch (err) {
        logger.error(err)
      }
    }

    closeProjectContextMenu()
    setUpdatingProject(false)
  }

  const pushProject = async (id: string) => {
    setUploadingProject(true)
    try {
      await ProjectService.pushProject(id)
      await fetchInstalledProjects()
    } catch (err) {
      logger.error(err)
    }
    setUploadingProject(false)
  }

  const isInstalled = (project: ProjectInterface | null) => {
    if (!project) return false

    for (const installedProject of installedProjects) {
      if (project.repositoryPath === installedProject.repositoryPath) return true
    }

    return false
  }

  const hasRepo = (project: ProjectInterface | null) => {
    if (!project) return false

    return project.repositoryPath && project.repositoryPath.length > 0
  }

  const handleSearch = (e) => {
    setQuery(e.target.value)

    if (filter.installed) {
    }

    if (filter.official) fetchOfficialProjects(e.target.value)

    if (filter.community) fetchCommunityProjects(e.target.value)
  }

  const clearSearch = () => setQuery('')
  const openFilterMenu = (e) => setFilterAnchorEl(e.target)
  const closeFilterMenu = () => setFilterAnchorEl(null)
  const toggleFilter = (type: string) => setFilter({ ...filter, [type]: !filter[type] })

  const openProjectContextMenu = (event: MouseEvent, project: ProjectInterface) => {
    event.preventDefault()
    event.stopPropagation()

    setActiveProject(project)
    setProjectAnchorEl(event.target)
  }

  const closeProjectContextMenu = () => setProjectAnchorEl(null)

  const renderProjectList = (projects: ProjectInterface[], areInstalledProjects?: boolean) => {
    if (!projects || projects.length <= 0) return <></>

    return (
      <ul className={styles.listContainer}>
        {projects.map((project: ProjectInterface, index) => (
          <li className={styles.itemContainer} key={index}>
            <a
              onClick={(e) => {
                areInstalledProjects ? onClickExisting(e, project) : window.open(project.repositoryPath)
              }}
            >
              <div
                className={styles.thumbnailContainer}
                style={{ backgroundImage: `url(${project.thumbnail})` }}
                id={'open-' + project.name}
              />
            </a>
            <div className={styles.headerContainer} id={'headerContainer-' + project.name}>
              <h3 className={styles.header}>{project.name.replace(/-/g, ' ')}</h3>
              {project.name !== 'default-project' && (
                <IconButton
                  className={styles.iconButton}
                  disableRipple
                  onClick={(e: any) => openProjectContextMenu(e, project)}
                >
                  <Settings />
                </IconButton>
              )}
            </div>
            {!areInstalledProjects && isInstalled(project) && (
              <span className={styles.installedIcon}>
                <DownloadDone />
              </span>
            )}
            {project.description && (
              <p className={styles.description} id={'description-' + project.name}>
                {project.description}
              </p>
            )}
          </li>
        ))}
      </ul>
    )
  }

  const handleOpenProjectDrawer = (changeDestination = false) => {
    setProjectDrawerOpen(true)
    setChangeDestination(changeDestination)
  }

  const handleCloseProjectDrawer = () => {
    setChangeDestination(false)
    setProjectDrawerOpen(false)
  }

  /**
   * Rendering view for projects page, if user is not login yet then showing login view.
   * if user is logged in and has no existing projects then the welcome view is shown, providing link to the tutorials.
   * if user has existing projects then we show the existing projects in grids and a grid to add new project.
   *
   */
  if (!authUser?.accessToken.value || authUser.accessToken.value.length === 0 || !user?.id.value) return <></>

  return (
    <main className={styles.projectPage}>
      <style>
        {`
        #menu-projectURL,
        #menu-branchData,
        #menu-commitData {
          z-index: 1500;
        }
        #engine-container {
          display: flex;
          flex-direction: column;
        }
        `}
      </style>
      <div className={styles.projectPageContainer}>
        <div className={styles.projectGridContainer}>
          <div className={styles.projectGridHeader}>
            <h2>{t(`editor.projects.title`)}</h2>
            <Paper component="form" classes={{ root: styles.searchInputRoot }}>
              <IconButton aria-label="menu" disableRipple onClick={openFilterMenu}>
                <FilterList />
              </IconButton>
              <Menu
                anchorEl={filterAnchorEl}
                open={Boolean(filterAnchorEl)}
                onClose={closeFilterMenu}
                classes={{ paper: styles.filterMenu }}
              >
                <MenuItem classes={{ root: styles.filterMenuItem }} onClick={() => toggleFilter('installed')}>
                  {filter.installed && <Check />}
                  {t(`editor.projects.installed`)}
                </MenuItem>
                <MenuItem classes={{ root: styles.filterMenuItem }} onClick={() => toggleFilter('official')}>
                  {filter.official && <Check />}
                  {t(`editor.projects.official`)}
                </MenuItem>
                <MenuItem classes={{ root: styles.filterMenuItem }} onClick={() => toggleFilter('community')}>
                  {filter.community && <Check />}
                  {t(`editor.projects.community`)}
                </MenuItem>
              </Menu>
              <InputBase
                value={query}
                classes={{ root: styles.inputRoot }}
                placeholder={t(`editor.projects.lbl-searchProject`)}
                inputProps={{ 'aria-label': t(`editor.projects.lbl-searchProject`) }}
                onChange={handleSearch}
              />
              {query ? (
                <IconButton aria-label="search" disableRipple onClick={clearSearch}>
                  <Clear />
                </IconButton>
              ) : (
                <IconButton aria-label="search" disableRipple>
                  <Search />
                </IconButton>
              )}
            </Paper>
            <div className={styles.buttonContainer}>
              <Button onClick={() => handleOpenProjectDrawer(false)} className={styles.btn}>
                {t(`editor.projects.install`)}
              </Button>
              <Button onClick={openCreateDialog} className={styles.btn}>
                {t(`editor.projects.lbl-createProject`)}
              </Button>
            </div>
          </div>
          <div className={styles.projectGrid}>
            {error && <div className={styles.errorMsg}>{error.message}</div>}
            {(!query || filter.installed) && (
              <ProjectExpansionList
                id={t(`editor.projects.installed`)}
                summary={`${t('editor.projects.installed')} (${installedProjects.length})`}
              >
                {renderProjectList(installedProjects, true)}
              </ProjectExpansionList>
            )}
            {(!query || (query && filter.official && officialProjects.length > 0)) && (
              <ProjectExpansionList
                id={t(`editor.projects.official`)}
                summary={`${t('editor.projects.official')} (${officialProjects.length})`}
              >
                {renderProjectList(officialProjects)}
              </ProjectExpansionList>
            )}
            {(!query || (!query && filter.community && communityProjects.length > 0)) && (
              <ProjectExpansionList
                id={t(`editor.projects.community`)}
                summary={`${t('editor.projects.community')} (${communityProjects.length})`}
              >
                {renderProjectList(communityProjects)}
              </ProjectExpansionList>
            )}
          </div>
        </div>
        {installedProjects.length < 2 && !loading ? (
          <div className={styles.welcomeContainer}>
            <h1>{t('editor.projects.welcomeMsg')}</h1>
            <h2>{t('editor.projects.description')}</h2>
            <MediumButton onClick={openTutorial}>{t('editor.projects.lbl-startTutorial')}</MediumButton>
          </div>
        ) : null}
      </div>
      {activeProject?.name !== 'default-project' && (
        <Menu
          anchorEl={projectAnchorEl}
          open={Boolean(projectAnchorEl)}
          onClose={closeProjectContextMenu}
          TransitionProps={{ onExited: () => setActiveProject(null) }}
          classes={{ paper: styles.filterMenu }}
        >
          {activeProject && isInstalled(activeProject) && (
            <MenuItem classes={{ root: styles.filterMenuItem }} onClick={openEditPermissionsDialog}>
              <Group />
              {t(`editor.projects.permissions`)}
            </MenuItem>
          )}
          {activeProject && isInstalled(activeProject) && hasRepo(activeProject) && ownsActiveProject && (
            <MenuItem classes={{ root: styles.filterMenuItem }} onClick={() => handleOpenProjectDrawer(false)}>
              <Download />
              {t(`editor.projects.updateFromGithub`)}
            </MenuItem>
          )}
          {activeProject && isInstalled(activeProject) && !hasRepo(activeProject) && ownsActiveProject && (
            <MenuItem classes={{ root: styles.filterMenuItem }} onClick={() => handleOpenProjectDrawer(true)}>
              <Link />
              {t(`editor.projects.link`)}
            </MenuItem>
          )}
          {activeProject && isInstalled(activeProject) && hasRepo(activeProject) && ownsActiveProject && (
            <MenuItem classes={{ root: styles.filterMenuItem }} onClick={() => handleOpenProjectDrawer(true)}>
              <LinkOff />
              {t(`editor.projects.unlink`)}
            </MenuItem>
          )}
          {activeProject?.hasWriteAccess && hasRepo(activeProject) && (
            <MenuItem classes={{ root: styles.filterMenuItem }} onClick={() => pushProject(activeProject.id)}>
              {uploadingProject ? <CircularProgress size={15} className={styles.progressbar} /> : <Upload />}
              {t(`editor.projects.pushToGithub`)}
            </MenuItem>
          )}
          {isInstalled(activeProject) && ownsActiveProject && (
            <MenuItem classes={{ root: styles.filterMenuItem }} onClick={openDeleteConfirm}>
              {updatingProject ? <CircularProgress size={15} className={styles.progressbar} /> : <Delete />}
              {t(`editor.projects.uninstall`)}
            </MenuItem>
          )}
          {!isInstalled(activeProject) && (
            <MenuItem classes={{ root: styles.filterMenuItem }} onClick={() => handleOpenProjectDrawer(false)}>
              {updatingProject ? <CircularProgress size={15} className={styles.progressbar} /> : <Download />}
              {t(`editor.projects.install`)}
            </MenuItem>
          )}
        </Menu>
      )}
      <CreateProjectDialog open={isCreateDialogOpen} onSuccess={onCreateProject} onClose={closeCreateDialog} />
      {activeProject && (
        <GithubRepoDialog open={repoLinkDialogOpen} onClose={closeRepoLinkDialog} project={activeProject} />
      )}
      {activeProject && activeProject.project_permissions && (
        <EditPermissionsDialog
          open={editPermissionsDialogOpen}
          onClose={closeEditPermissionsDialog}
          project={activeProject}
          projectPermissions={activeProject.project_permissions}
          addPermission={onCreatePermission}
          patchPermission={onPatchPermission}
          removePermission={onRemovePermission}
        />
      )}
      <ProjectDrawer
        open={projectDrawerOpen}
        inputProject={activeProject}
        existingProject={activeProject != null}
        onClose={handleCloseProjectDrawer}
        changeDestination={changeDestination}
      />
      <DeleteDialog
        open={isDeleteDialogOpen}
        isProjectMenu
        onCancel={closeDeleteConfirm}
        onClose={closeDeleteConfirm}
        onConfirm={deleteProject}
      />
    </main>
  )
}

export default ProjectsPage
