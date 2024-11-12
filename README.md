# Macro AI Monorepo

This monorepo contains the source code for Macro AI, a project that includes both frontend and backend applications. It is structured using `pnpm` workspaces to manage dependencies efficiently across multiple packages and applications.

## Repository Structure

- **Packages**

  - **`ui-library`**: Contains reusable UI components, utilities, and configurations for Tailwind CSS. It provides a shared TypeScript configuration for React projects.
  - **`config-typescript`**: Provides base TypeScript configurations for different environments, including React and Express.
  - **`config-eslint`**: Contains shared ESLint configurations for consistent code quality across the monorepo.

- **Applications**
  - **`client-ui`**: A React application built with Vite. It uses Tailwind CSS for styling and includes a setup for both application and node environments.
  - **`express-api`**: An Express application with TypeScript setup. It includes basic routing and logging using `pino`.

## Getting Started

### Prerequisites

- **Node.js**: Ensure you have Node.js version 20 or higher.
- **pnpm**: Install pnpm globally using `npm install -g pnpm`.

### Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/yourusername/macro-ai.git
   cd macro-ai
   ```

2. Install dependencies:

   ```bash
   pnpm install
   ```

### Development

#### Client UI

To start the React application:

```bash
cd apps/client-ui
pnpm dev
```

This will start the Vite development server on port 3000.

#### Express API

To start the Express server:

```bash
cd apps/express-api
pnpm dev
```

The server will run on the port specified in the environment variable `SERVER_PORT` or default to 3030.

### Building

To build all packages and applications:

```bash
pnpm build
```

### TurboRepo Scripts

The base `package.json` includes several scripts for managing the monorepo:

- **`commit`**: Use `commitizen` to create standardized commit messages.
- **`build`**: Run the build process for all packages and applications using TurboRepo.
- **`dev`**: Start the development servers for all applications.
- **`lint`**: Run ESLint across the codebase to ensure code quality.
- **`format`**: Check code formatting using Prettier.
- **`format:fix`**: Automatically fix code formatting issues using Prettier.
- **`ui`**: Run UI-related tasks filtered by the `@repo/ui` package.

These scripts are defined in the root `package.json`:

## Contributing

Contributions are welcome! Please ensure that your code adheres to the project's coding standards and passes all tests before submitting a pull request.

## License

This project is licensed under the MIT License.
