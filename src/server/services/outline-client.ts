import { logger } from '../logger';

interface OutlineDocument {
  id: string;
  title: string;
  text: string;
  collectionId: string;
  url: string;
  updatedAt: string;
  createdAt: string;
}

interface OutlineSearchResult {
  ranking: number;
  context: string;
  document: OutlineDocument;
}

interface OutlineListResponse {
  data: OutlineDocument[];
  pagination: {
    offset: number;
    limit: number;
  };
}

interface OutlineSearchResponse {
  data: OutlineSearchResult[];
  pagination: {
    offset: number;
    limit: number;
  };
}

interface OutlineDocumentResponse {
  data: OutlineDocument;
}

interface OutlineCollection {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
}

interface OutlineCollectionsResponse {
  data: OutlineCollection[];
  pagination: {
    offset: number;
    limit: number;
  };
}

export interface OutlineCredentials {
  apiUrl: string;
  apiKey: string;
  collectionId?: string;
}

/**
 * Client for interacting with the Outline API
 * Documentation: https://www.getoutline.com/developers
 */
export class OutlineClient {
  private apiUrl: string;
  private baseUrl: string; // Outline base URL without /api
  private apiKey: string;
  private defaultCollectionId?: string;

  constructor(credentials?: OutlineCredentials) {
    if (credentials) {
      // Store the base URL (strip /api if present, and remove trailing slash)
      let baseUrl = credentials.apiUrl.endsWith('/api')
        ? credentials.apiUrl.slice(0, -4)
        : credentials.apiUrl;

      // Remove trailing slash if present
      this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

      // API URL always has /api
      this.apiUrl = `${this.baseUrl}/api`;
      this.apiKey = credentials.apiKey;
      this.defaultCollectionId = credentials.collectionId;
    } else {
      // No credentials provided - client will not be functional
      this.baseUrl = 'https://app.getoutline.com';
      this.apiUrl = 'https://app.getoutline.com/api';
      this.apiKey = '';
      this.defaultCollectionId = undefined;
    }
  }

  /**
   * Check if Outline integration is enabled
   */
  isEnabled(): boolean {
    return !!this.apiKey;
  }

  /**
   * Make an authenticated request to the Outline API
   */
  private async request<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
    if (!this.apiKey) {
      throw new Error('Outline API key not configured');
    }

    const url = `${this.apiUrl}${endpoint}`;
    logger.info({ endpoint, body }, 'Outline API request');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error({ status: response.status, errorText, url }, 'Outline API error');

      if (response.status === 404) {
        throw new Error(
          `Outline API endpoint not found. Please verify: ` +
            `1) Your Outline instance URL is correct, ` +
            `2) The API is enabled on your instance, ` +
            `3) Your API key is valid`
        );
      }

      if (response.status === 401 || response.status === 403) {
        throw new Error(`Outline API authentication failed. Please check your API key.`);
      }

      throw new Error(`Outline API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data as T;
  }

  /**
   * Create a new document in Outline
   */
  async createDocument(params: {
    title: string;
    text?: string;
    collectionId?: string;
    publish?: boolean;
  }): Promise<OutlineDocument> {
    const collectionId = params.collectionId || this.defaultCollectionId;

    if (!collectionId) {
      throw new Error(
        'Collection ID is required. Set OUTLINE_COLLECTION_ID or provide collectionId parameter'
      );
    }

    const response = await this.request<OutlineDocumentResponse>('/documents.create', {
      title: params.title,
      text: params.text || '',
      collectionId,
      publish: params.publish ?? true
    });

    logger.info({ id: response.data.id, title: response.data.title }, 'Created Outline document');

    // Override URL with correct base URL (Outline API might return wrong URL)
    return {
      ...response.data,
      url: this.getDocumentUrl(response.data.id)
    };
  }

  /**
   * Search for documents in Outline
   */
  async searchDocuments(
    query: string,
    options?: {
      limit?: number;
      offset?: number;
      collectionId?: string;
    }
  ): Promise<OutlineSearchResult[]> {
    const response = await this.request<OutlineSearchResponse>('/documents.search', {
      query,
      limit: options?.limit || 10,
      offset: options?.offset || 0,
      ...(options?.collectionId && { collectionId: options.collectionId })
    });

    logger.info({ query, results: response.data.length }, 'Searched Outline documents');

    // Override URLs in search results with correct base URL
    return response.data.map((result) => ({
      ...result,
      document: {
        ...result.document,
        url: this.getDocumentUrl(result.document.id)
      }
    }));
  }

  /**
   * List documents in Outline
   */
  async listDocuments(options?: {
    limit?: number;
    offset?: number;
    collectionId?: string;
  }): Promise<OutlineDocument[]> {
    const response = await this.request<OutlineListResponse>('/documents.list', {
      limit: options?.limit || 25,
      offset: options?.offset || 0,
      ...(options?.collectionId && { collectionId: options.collectionId })
    });

    logger.info({ count: response.data.length }, 'Listed Outline documents');
    return response.data;
  }

  /**
   * List collections in Outline
   */
  async listCollections(): Promise<OutlineCollection[]> {
    const response = await this.request<OutlineCollectionsResponse>('/collections.list', {
      limit: 100
    });

    logger.info({ count: response.data.length }, 'Listed Outline collections');
    return response.data;
  }

  /**
   * Get a specific document by ID
   */
  async getDocument(documentId: string): Promise<OutlineDocument> {
    const response = await this.request<OutlineDocumentResponse>('/documents.info', {
      id: documentId
    });

    // Override URL with correct base URL (Outline API might return wrong URL)
    return {
      ...response.data,
      url: this.getDocumentUrl(response.data.id)
    };
  }

  /**
   * Update a document in Outline
   */
  async updateDocument(
    documentId: string,
    params: {
      title?: string;
      text?: string;
      publish?: boolean;
    }
  ): Promise<OutlineDocument> {
    const response = await this.request<OutlineDocumentResponse>('/documents.update', {
      id: documentId,
      ...params
    });

    logger.info({ id: documentId }, 'Updated Outline document');
    return response.data;
  }

  /**
   * Get the URL for viewing a document in Outline
   * Note: Outline API returns the URL in the document object, but we need this for cases
   * where we only have the document ID.
   */
  getDocumentUrl(documentId: string): string {
    // Use URL constructor to properly join base URL and path
    const url = new URL(`/doc/${documentId}`, this.baseUrl);
    return url.href;
  }
}

// Helper function to create an Outline client from user settings
export function createOutlineClient(userSettings: {
  outlineApiUrl?: string;
  outlineApiKey?: string;
  outlineCollectionId?: string;
}): OutlineClient | null {
  if (!userSettings.outlineApiUrl || !userSettings.outlineApiKey) {
    return null;
  }

  return new OutlineClient({
    apiUrl: userSettings.outlineApiUrl,
    apiKey: userSettings.outlineApiKey,
    collectionId: userSettings.outlineCollectionId
  });
}

// Singleton instance for backward compatibility (uses env vars)
export const outlineClient = new OutlineClient();
