/**
 * adapted from https://github.com/soldair/node-gitconfiglocal
 */
import fs from 'fs'
import ini from 'ini'

import logger from '../ServerLogger'

export interface GitConfigData {
  core: {
    repositoryformatversion: number
    filemode: boolean
    bare: boolean
    logallrefupdates: boolean
  }
  remote: {
    [remote: string]: {
      url: string
      fetch: string
    }
  }
  branch: {
    [branch: string]: {
      remote: string
      merge: string
    }
  }
}

export function getGitHeadData(dir: string): string | undefined {
  dir = dir + '/HEAD'

  if (!fs.existsSync(dir)) {
    logger.warn('[Projects]: Could not find git HEAD file at: ' + dir)
    return null!
  }
  const data = fs.readFileSync(dir)
  try {
    return data.toString().split(':')[1].trim().split('/').pop()
  } catch (e) {
    logger.error(e, `Error getting git HEAD data: ${e.message}`)
  }
  return null!
}

export function getGitOrigHeadData(dir: string): string | undefined {
  dir = dir + '/ORIG_HEAD'

  if (!fs.existsSync(dir)) {
    logger.warn('[Projects]: Could not find git ORIG_HEAD file at: ' + dir)
    return null!
  }
  const data = fs.readFileSync(dir)
  try {
    return data.toString().trim()
  } catch (e) {
    logger.error(e, `Error getting git ORIG_HEAD data: ${e.message}`)
  }
  return null!
}

export function getGitConfigData(dir: string): GitConfigData {
  dir = dir + '/config'

  if (!fs.existsSync(dir)) {
    logger.warn('[Projects]: Could not find git config file at: ' + dir)
    return null!
  }
  const data = fs.readFileSync(dir)
  try {
    return format(ini.parse(data.toString())) as GitConfigData
  } catch (e) {
    logger.error(e, `Error getting git config data: ${e.message}`)
  }
  return null!
}

function format(data) {
  const out = {}
  Object.keys(data).forEach(function (k) {
    if (k.indexOf('"') > -1) {
      const parts = k.split('"')
      const parentKey = parts.shift()!.trim()
      const childKey = parts.shift()!.trim()
      if (!out[parentKey]) out[parentKey] = {}
      out[parentKey][childKey] = data[k]
    } else {
      //@ts-ignore
      out[k] = merge(out[k], data[k])
      // cant start using these without bumping the major
      //out[k] = {...out[k], ...data[k]};
    }
  })
  return out
}

function merge() {
  const a = {}
  for (var i = arguments.length; i >= 0; --i) {
    Object.keys(arguments[i] || {}).forEach((k) => {
      a[k] = arguments[i][k]
    })
  }
  return a
}
