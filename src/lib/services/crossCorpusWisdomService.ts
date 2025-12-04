// src/lib/services/crossCorpusWisdomService.ts
import { categoryService } from '../database/categoryService';
import { corpusChecker } from './corpusChecker';
import { Storage } from '@google-cloud/storage';

export interface CrossCorpusWisdomOptions {
  userPreference?: string; // specific category or 'random'
  excludeRecent?: string[]; // recently shown sources to avoid repetition
  diversityMode?: 'balanced' | 'weighted' | 'random';
}

export interface SelectedCorpusSource {
  folderName: string;
  displayName: string;
  category: string;
  isAvailable: boolean;
  selectionReason: string;
}

class CrossCorpusWisdomService {
  
  // Initialize Google Cloud Storage with same robust pattern as existing services
  private initializeStorage() {
    try {
      // CRITICAL: Use ONLY environment variables - no file path fallback
      if (process.env.GOOGLE_CLOUD_PROJECT_ID && process.env.GOOGLE_CLOUD_PRIVATE_KEY && process.env.GOOGLE_CLOUD_CLIENT_EMAIL) {
        return new Storage({
          projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
          credentials: {
            client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
            private_key: process.env.GOOGLE_CLOUD_PRIVATE_KEY.replace(/\\n/g, '\n').replace(/^"|"$/g, ''),
          },
        });
      }
      
      throw new Error(
        'Google Cloud credentials not found. ' +
        'Please set GOOGLE_CLOUD_PROJECT_ID, GOOGLE_CLOUD_PRIVATE_KEY, and GOOGLE_CLOUD_CLIENT_EMAIL environment variables. ' +
        'File-based credentials (GOOGLE_APPLICATION_CREDENTIALS) are not supported to avoid hardcoded paths.'
      );
    } catch (error) {
      console.error('Error initializing Google Cloud Storage:', error);
      throw error;
    }
  }
  
  // GCS-first approach - scan what actually exists first
  async getAllAvailableSources(): Promise<string[]> {
    try {
      // Direct GCS scan - see what actually exists first
      const storage = this.initializeStorage();
      const bucketName = 'mygurukul-sacred-texts-corpus';
      const bucket = storage.bucket(bucketName);
      
      console.log('Scanning GCS bucket for actual available documents...');
      const [files] = await bucket.getFiles();
      
      // Group files by folder to find folders with actual content
      const folderCounts = new Map<string, number>();
      
      files.forEach(file => {
        const pathParts = file.name.split('/');
        if (pathParts.length > 1 && pathParts[0].trim()) {
          const folderName = pathParts[0];
          folderCounts.set(folderName, (folderCounts.get(folderName) || 0) + 1);
        }
      });
      
      // Only include folders with substantial content (more than 2 files)
      const actuallyAvailableFolders = Array.from(folderCounts.entries())
        .filter(([folder, count]) => count > 2)  // Has real content
        .map(([folder, count]) => folder)
        .sort();
      
      console.log(`GCS-first scan found ${actuallyAvailableFolders.length} folders with content:`, 
        actuallyAvailableFolders.map(f => `${f}(${folderCounts.get(f)} files)`));
      
      return actuallyAvailableFolders.length > 0 ? actuallyAvailableFolders : ['Ramayana'];
      
    } catch (error) {
      console.error('Error scanning GCS for available documents:', error);
      return ['Ramayana']; // fallback
    }
  }
  
  // Intelligent source selection using existing corpus infrastructure
  async selectWisdomSource(options: CrossCorpusWisdomOptions = {}): Promise<SelectedCorpusSource> {
    try {
      console.log('=== CROSS-CORPUS DIAGNOSTIC ===');
      console.log('User preference:', options.userPreference);
      
      const availableSources = await this.getAllAvailableSources();
      console.log('Available folder count:', availableSources.length);
      
      // 1. Handle User Preference
      if (options.userPreference && options.userPreference !== 'random') {
        // FIX: Capture the value in a const so TypeScript knows it's safe inside the callback
        const preference = options.userPreference;
        const preferredSource = availableSources.find(source => 
          source.toLowerCase().includes(preference.toLowerCase())
        );
        if (preferredSource) {
          console.log('Selected folder:', preferredSource);
          console.log('Selection algorithm used:', 'user-specified');
          return {
            folderName: preferredSource,
            displayName: this.formatDisplayName(preferredSource),
            category: await this.getCategoryForSource(preferredSource),
            isAvailable: true,
            selectionReason: 'user-specified'
          };
        }
      }
      
      let candidateSources = [...availableSources];
      
      // 2. Filter out recently used sources
      if (options.excludeRecent && options.excludeRecent.length > 0) {
        // FIX: Capture the array in a const so TypeScript knows it's safe inside the callback
        const excludeList = options.excludeRecent;
        candidateSources = availableSources.filter(source => 
          !excludeList.includes(source)
        );
        
        // If we filtered everything out (e.g. cycle complete), reset to all available
        if (candidateSources.length === 0) {
          candidateSources = [...availableSources];
        }
      }
      
      // Random selection with optional weighting
      const selectedSource = this.selectWithDiversity(candidateSources, options.diversityMode);
      
      console.log('Selected folder:', selectedSource);
      console.log('Selection algorithm used:', options.diversityMode || 'balanced');
      
      return {
        folderName: selectedSource,
        displayName: this.formatDisplayName(selectedSource),
        category: await this.getCategoryForSource(selectedSource),
        isAvailable: true,
        selectionReason: 'intelligent-selection'
      };
      
    } catch (error) {
      console.error('Error selecting wisdom source:', error);
      console.log('Selected folder:', 'ramayana');
      console.log('Selection algorithm used:', 'fallback');
      return {
        folderName: 'ramayana',
        displayName: 'Ramayana',
        category: 'Life Purpose & Ethics',
        isAvailable: true,
        selectionReason: 'fallback'
      };
    }
  }
  
  // Helper methods
  private selectWithDiversity(sources: string[], mode: string = 'balanced'): string {
    const randomIndex = Math.floor(Math.random() * sources.length);
    console.log(`Diversity selection: ${sources.length} candidates, mode: ${mode}, random index: ${randomIndex}`);
    return sources[randomIndex];
  }
  
  private formatDisplayName(folderName: string | undefined): string {
    if (!folderName) {
      return 'Unknown Source';
    }
    return folderName.replace(/([A-Z])/g, ' $1').trim()
      .split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  }
  
  private async getCategoryForSource(folderName: string): Promise<string> {
    try {
      // Use Library Tab's system to find category for available sources
      const categories = categoryService.getCategories();
      for (const category of categories) {
        const categoryWithTexts = await categoryService.getCategoryWithTexts(category.id);
        if (categoryWithTexts) {
          const foundText = categoryWithTexts.texts.find(text => 
            text.status === 'available' && text.cloudFolderPath === folderName
          );
          if (foundText) {
            return category.name;
          }
        }
      }
      return 'Sacred Texts';
    } catch (error) {
      console.error('Error finding category for source:', error);
      return 'Sacred Texts';
    }
  }
}

export const crossCorpusWisdomService = new CrossCorpusWisdomService();
