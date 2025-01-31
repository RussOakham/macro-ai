/* eslint-disable */

// @ts-nocheck

// noinspection JSUnusedGlobalSymbols

// This file was automatically generated by TanStack Router.
// You should NOT make any changes in this file as it will be overwritten.
// Additionally, you should also exclude this file from your linter and/or formatter to prevent it from being checked or modified.

import { createFileRoute } from '@tanstack/react-router'

// Import Routes

import { Route as rootRoute } from './routes/__root'

// Create Virtual Routes

const IndexLazyImport = createFileRoute('/')()
const AuthRegisterLazyImport = createFileRoute('/auth/register')()
const AuthLoginLazyImport = createFileRoute('/auth/login')()

// Create/Update Routes

const IndexLazyRoute = IndexLazyImport.update({
	id: '/',
	path: '/',
	getParentRoute: () => rootRoute,
} as any).lazy(() => import('./routes/index.lazy').then((d) => d.Route))

const AuthRegisterLazyRoute = AuthRegisterLazyImport.update({
	id: '/auth/register',
	path: '/auth/register',
	getParentRoute: () => rootRoute,
} as any).lazy(() => import('./routes/auth/register.lazy').then((d) => d.Route))

const AuthLoginLazyRoute = AuthLoginLazyImport.update({
	id: '/auth/login',
	path: '/auth/login',
	getParentRoute: () => rootRoute,
} as any).lazy(() => import('./routes/auth/login.lazy').then((d) => d.Route))

// Populate the FileRoutesByPath interface

declare module '@tanstack/react-router' {
	interface FileRoutesByPath {
		'/': {
			id: '/'
			path: '/'
			fullPath: '/'
			preLoaderRoute: typeof IndexLazyImport
			parentRoute: typeof rootRoute
		}
		'/auth/login': {
			id: '/auth/login'
			path: '/auth/login'
			fullPath: '/auth/login'
			preLoaderRoute: typeof AuthLoginLazyImport
			parentRoute: typeof rootRoute
		}
		'/auth/register': {
			id: '/auth/register'
			path: '/auth/register'
			fullPath: '/auth/register'
			preLoaderRoute: typeof AuthRegisterLazyImport
			parentRoute: typeof rootRoute
		}
	}
}

// Create and export the route tree

export interface FileRoutesByFullPath {
	'/': typeof IndexLazyRoute
	'/auth/login': typeof AuthLoginLazyRoute
	'/auth/register': typeof AuthRegisterLazyRoute
}

export interface FileRoutesByTo {
	'/': typeof IndexLazyRoute
	'/auth/login': typeof AuthLoginLazyRoute
	'/auth/register': typeof AuthRegisterLazyRoute
}

export interface FileRoutesById {
	__root__: typeof rootRoute
	'/': typeof IndexLazyRoute
	'/auth/login': typeof AuthLoginLazyRoute
	'/auth/register': typeof AuthRegisterLazyRoute
}

export interface FileRouteTypes {
	fileRoutesByFullPath: FileRoutesByFullPath
	fullPaths: '/' | '/auth/login' | '/auth/register'
	fileRoutesByTo: FileRoutesByTo
	to: '/' | '/auth/login' | '/auth/register'
	id: '__root__' | '/' | '/auth/login' | '/auth/register'
	fileRoutesById: FileRoutesById
}

export interface RootRouteChildren {
	IndexLazyRoute: typeof IndexLazyRoute
	AuthLoginLazyRoute: typeof AuthLoginLazyRoute
	AuthRegisterLazyRoute: typeof AuthRegisterLazyRoute
}

const rootRouteChildren: RootRouteChildren = {
	IndexLazyRoute: IndexLazyRoute,
	AuthLoginLazyRoute: AuthLoginLazyRoute,
	AuthRegisterLazyRoute: AuthRegisterLazyRoute,
}

export const routeTree = rootRoute
	._addFileChildren(rootRouteChildren)
	._addFileTypes<FileRouteTypes>()

/* ROUTE_MANIFEST_START
{
  "routes": {
    "__root__": {
      "filePath": "__root.tsx",
      "children": [
        "/",
        "/auth/login",
        "/auth/register"
      ]
    },
    "/": {
      "filePath": "index.lazy.tsx"
    },
    "/auth/login": {
      "filePath": "auth/login.lazy.tsx"
    },
    "/auth/register": {
      "filePath": "auth/register.lazy.tsx"
    }
  }
}
ROUTE_MANIFEST_END */
