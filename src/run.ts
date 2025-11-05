import { readFile, stat } from 'node:fs/promises'
import { basename, relative } from 'node:path'
import { debug, getInput, info, setFailed } from '@actions/core'
import { getOctokit } from '@actions/github'
import { create } from '@actions/glob'

export async function run() {
  const uploadUrl = getInput('upload_url').split('{')[0]
  const assetPath = getInput('asset_path')
  const token = getInput('token')
  const octokit = getOctokit(token)
  const globber = await create(assetPath)
  const files = await globber.glob()
  if (files.length === 0) {
    setFailed('No files found')
    return
  }
  try {
    info(`Uploading ${files.length} files to ${uploadUrl}`)
    info(
      `Files:\n${files.map((file) => `- ${relative(process.cwd(), file)}`).join('\n')}`,
    )
    await Promise.all(
      files.map(async (file) => {
        debug(`Uploading ${file} to ${uploadUrl}`)
        const url = new URL(uploadUrl)
        url.searchParams.set('name', basename(file))
        await octokit.request({
          method: 'POST',
          url: url.toString(),
          headers: {
            'content-length': `${(await stat(file)).size}`,
            'content-type': 'application/octet-stream',
            authorization: `token ${token}`,
          },
          data: await readFile(file),
        })
        debug(`Uploaded ${file} to ${uploadUrl}`)
      }),
    )
  } catch (error) {
    setFailed(error as Error)
  }
}
