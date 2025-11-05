import { afterAll, expect, mock, spyOn, test } from 'bun:test'
import * as fs from 'node:fs/promises'
import * as core from '@actions/core'
import * as github from '@actions/github'
import * as glob from '@actions/glob'
import { run } from '../run'

afterAll(() => {
  process.exitCode = 0
})

test('when no files are found, setFailed should be called', async () => {
  const mockGetInput = spyOn(core, 'getInput').mockImplementation(
    (name: string) => {
      if (name === 'upload_url')
        return 'https://api.github.com/repos/owner/repo/releases/123/assets'
      if (name === 'asset_path') return '**/*.txt'
      return 'test-token'
    },
  )

  const mockCreate = spyOn(glob, 'create').mockResolvedValue({
    glob: async () => [],
  } as unknown as glob.Globber)

  const mockSetFailed = spyOn(core, 'setFailed')

  await run()

  expect(mockSetFailed).toHaveBeenCalledWith('No files found')

  mockGetInput.mockRestore()
  mockCreate.mockRestore()
  mockSetFailed.mockRestore()
})

test('when files are found, they should be uploaded successfully', async () => {
  const mockGetInput = spyOn(core, 'getInput').mockImplementation(
    (name: string) => {
      if (name === 'upload_url')
        return 'https://api.github.com/repos/owner/repo/releases/123/assets'
      if (name === 'asset_path') return '**/*.txt'
      return 'test-token'
    },
  )

  const mockFiles = ['file1.txt', 'file2.txt']
  const mockGlobber = {
    glob: async () => mockFiles,
  }
  const mockCreate = spyOn(glob, 'create').mockResolvedValue(
    mockGlobber as unknown as glob.Globber,
  )

  const mockRequest = mock(() => Promise.resolve({}))
  const mockOctokit = {
    request: mockRequest,
  }
  const mockGetOctokit = spyOn(github, 'getOctokit').mockReturnValue(
    mockOctokit as unknown as ReturnType<typeof github.getOctokit>,
  )

  const mockStat = spyOn(fs, 'stat').mockResolvedValue({
    size: 1024,
  } as unknown as Awaited<ReturnType<typeof fs.stat>>)
  const mockOpen = spyOn(fs, 'open').mockResolvedValue({
    readableWebStream: () => new ReadableStream(),
  } as unknown as fs.FileHandle)

  const mockInfo = spyOn(core, 'info').mockImplementation(() => {})
  const mockDebug = spyOn(core, 'debug').mockImplementation(() => {})

  await run()

  expect(mockInfo).toHaveBeenCalledWith(
    'Uploading 2 files to https://api.github.com/repos/owner/repo/releases/123/assets',
  )
  expect(mockInfo).toHaveBeenCalledWith('Files: file1.txt\nfile2.txt')
  expect(mockRequest).toHaveBeenCalledTimes(2)
  expect(mockDebug).toHaveBeenCalledWith(
    'Uploading file1.txt to https://api.github.com/repos/owner/repo/releases/123/assets',
  )
  expect(mockDebug).toHaveBeenCalledWith(
    'Uploading file2.txt to https://api.github.com/repos/owner/repo/releases/123/assets',
  )
  expect(mockDebug).toHaveBeenCalledWith(
    'Uploaded file1.txt to https://api.github.com/repos/owner/repo/releases/123/assets',
  )
  expect(mockDebug).toHaveBeenCalledWith(
    'Uploaded file2.txt to https://api.github.com/repos/owner/repo/releases/123/assets',
  )

  // check if stat and open are called for each file
  expect(mockStat).toHaveBeenCalledTimes(2)
  expect(mockOpen).toHaveBeenCalledTimes(2)

  // check request call arguments
  const requestCalls = mockRequest.mock.calls
  expect(
    (requestCalls[0] as unknown as [Parameters<typeof mockOctokit.request>])[0],
  ).toMatchObject({
    method: 'POST',
    url: 'https://api.github.com/repos/owner/repo/releases/123/assets?name=file1.txt',
    headers: {
      'content-length': '1024',
      'content-type': 'application/octet-stream',
      authorization: 'token test-token',
    },
  })

  mockGetInput.mockRestore()
  mockCreate.mockRestore()
  mockGetOctokit.mockRestore()
  mockStat.mockRestore()
  mockOpen.mockRestore()
  mockInfo.mockRestore()
  mockDebug.mockRestore()
})

test('when an error occurs during upload, setFailed should be called', async () => {
  const mockGetInput = spyOn(core, 'getInput').mockImplementation(
    (name: string) => {
      if (name === 'upload_url')
        return 'https://api.github.com/repos/owner/repo/releases/123/assets'
      if (name === 'asset_path') return '**/*.txt'
      return 'test-token'
    },
  )

  const mockFiles = ['file1.txt']
  const mockGlobber = {
    glob: async () => mockFiles,
  }
  const mockCreate = spyOn(glob, 'create').mockResolvedValue(
    mockGlobber as unknown as glob.Globber,
  )

  const error = new Error('Upload failed')
  const mockRequest = mock(() => Promise.reject(error))
  const mockOctokit = {
    request: mockRequest,
  }
  const mockGetOctokit = spyOn(github, 'getOctokit').mockReturnValue(
    mockOctokit as unknown as ReturnType<typeof github.getOctokit>,
  )

  const mockStat = spyOn(fs, 'stat').mockResolvedValue({
    size: 1024,
  } as unknown as Awaited<ReturnType<typeof fs.stat>>)
  const mockOpen = spyOn(fs, 'open').mockResolvedValue({
    readableWebStream: () => new ReadableStream(),
  } as unknown as fs.FileHandle)

  const mockInfo = spyOn(core, 'info').mockImplementation(() => {})
  const mockDebug = spyOn(core, 'debug').mockImplementation(() => {})
  const mockSetFailed = spyOn(core, 'setFailed')

  await run()

  expect(mockSetFailed).toHaveBeenCalledWith(error)

  mockGetInput.mockRestore()
  mockCreate.mockRestore()
  mockGetOctokit.mockRestore()
  mockStat.mockRestore()
  mockOpen.mockRestore()
  mockInfo.mockRestore()
  mockDebug.mockRestore()
  mockSetFailed.mockRestore()
})

test('single file upload test', async () => {
  const mockGetInput = spyOn(core, 'getInput').mockImplementation(
    (name: string) => {
      if (name === 'upload_url')
        return 'https://api.github.com/repos/owner/repo/releases/123/assets'
      if (name === 'asset_path') return 'test.txt'
      return 'test-token'
    },
  )

  const mockFiles = ['test.txt']
  const mockGlobber = {
    glob: async () => mockFiles,
  }
  const mockCreate = spyOn(glob, 'create').mockResolvedValue(
    mockGlobber as unknown as glob.Globber,
  )

  const mockRequest = mock(() => Promise.resolve({}))
  const mockOctokit = {
    request: mockRequest,
  }
  const mockGetOctokit = spyOn(github, 'getOctokit').mockReturnValue(
    mockOctokit as unknown as ReturnType<typeof github.getOctokit>,
  )

  const mockStat = spyOn(fs, 'stat').mockResolvedValue({
    size: 2048,
  } as unknown as Awaited<ReturnType<typeof fs.stat>>)
  const mockOpen = spyOn(fs, 'open').mockResolvedValue({
    readableWebStream: () => new ReadableStream(),
  } as unknown as fs.FileHandle)

  const mockInfo = spyOn(core, 'info').mockImplementation(() => {})
  const mockDebug = spyOn(core, 'debug').mockImplementation(() => {})

  await run()

  expect(mockInfo).toHaveBeenCalledWith(
    'Uploading 1 files to https://api.github.com/repos/owner/repo/releases/123/assets',
  )
  expect(mockInfo).toHaveBeenCalledWith('Files: test.txt')
  expect(mockRequest).toHaveBeenCalledTimes(1)
  expect(mockStat).toHaveBeenCalledWith('test.txt')
  expect(mockOpen).toHaveBeenCalledWith('test.txt')

  mockGetInput.mockRestore()
  mockCreate.mockRestore()
  mockGetOctokit.mockRestore()
  mockStat.mockRestore()
  mockOpen.mockRestore()
  mockInfo.mockRestore()
  mockDebug.mockRestore()
})
