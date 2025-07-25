import {
  McpServer,
  ResourceTemplate,
} from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import z from 'zod';
import fs from 'fs/promises';

const server = new McpServer({
  name: 'test',
  version: '1.0.0',
  capabilities: {
    resources: {},
    tools: {},
    prompts: {},
  },
});

server.resource(
  'users',
  'users://all', // it can referencing anything file -- the protocol should follow xyz://...
  {
    description: 'Get all users data from the database',
    title: 'Users',
    mimeType: 'application/json', // what type of data is being returned
  },
  async (uri) => {
    const users = await getUsers();

    return {
      contents: [
        {
          uri: uri.href,
          text: JSON.stringify(users),
          mimeType: 'application/json',
        },
      ],
    };
  }
);

/**
 * - A URI pattern (with dynamic segments) used to generate or match resource URIs.
 * - Provides a pattern/template for generating or resolving resource URIs.
 */
server.resource(
  'user-details',
  new ResourceTemplate('users://{userId}/profile', { list: undefined }),
  {
    description: "Get user's details from the database",
    title: 'User details',
    mimeType: 'application/json', // what type of data is being returned
  },
  async (uri, { userId }) => {
    const user = (await getUsers()).find(
      (u) => u.id == parseInt(userId as string)
    );

    if (user == null) {
      return {
        contents: [
          {
            uri: uri.href,
            text: JSON.stringify({ error: 'User not found' }),
            mimeType: 'application/json',
          },
        ],
      };
    }

    return {
      contents: [
        {
          uri: uri.href,
          text: JSON.stringify(user),
          mimeType: 'application/json',
        },
      ],
    };
  }
);

server.tool(
  'create-user',
  'Create a new user in the database',
  {
    name: z.string(),
    email: z.string(),
    address: z.string(),
    phone: z.string(),
  },
  {
    title: 'Create User',
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  },
  async (params) => {
    try {
      const id = await createUser(params);
      return {
        content: [{ type: 'text', text: `User ${id} created successfully` }],
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: 'Failed to save user' }],
      };
    }
  }
);

async function createUser(user: {
  name: string;
  email: string;
  address: string;
  phone: string;
}) {
  const users = await getUsers();

  const id = users.length + 1;

  users.push({ id, ...user });

  await fs.writeFile('./data/users.json', JSON.stringify(users, null, 2));

  return id;
}

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

async function getUsers() {
  return await import('../data/users.json', {
    with: { type: 'json' },
  }).then((m) => m.default);
}

main();
