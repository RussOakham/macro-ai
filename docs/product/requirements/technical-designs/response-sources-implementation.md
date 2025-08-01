# Response Sources Implementation Technical Design

## Status: ⚠️ IN_DEVELOPMENT

This document defines the technical architecture for implementing response sources sidebar functionality in the Macro AI
application. We will design a scalable, performant system that provides comprehensive source attribution, quality
assessment, and research workflow integration while maintaining excellent user experience.

## 🎯 Executive Summary

The response sources implementation enables real-time source attribution for AI responses through an integrated sidebar
interface. The system extracts, validates, and presents relevant sources while providing quality assessment, citation
management, and research workflow capabilities that establish our competitive advantage in research and professional
AI assistance.

## 🏗️ System Architecture Overview

### High-Level Architecture

```text
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend (React/TypeScript)                  │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐   │
│  │   Chat Interface│ │  Sources Sidebar│ │ Citation Tools  │   │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│                     API Gateway Layer                           │
├─────────────────────────────────────────────────────────────────┤
│                  Source Attribution Service                     │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐   │
│  │Source Extractor │ │ Quality Assessor│ │Citation Manager │   │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│                    External Data Sources                        │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐   │
│  │Academic APIs    │ │   News APIs     │ │Government Data  │   │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│                      Data Layer                                 │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐   │
│  │   PostgreSQL    │ │     Redis       │ │   Vector DB     │   │
│  │   (Sources)     │ │    (Cache)      │ │  (Embeddings)   │   │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### Core Components

#### 1. **Source Attribution Service**

**Purpose**: Central service that orchestrates source extraction, quality assessment, and attribution for AI responses.

**Key Responsibilities**:

- Real-time source extraction during AI response generation
- Source quality assessment and credibility scoring
- Citation generation and formatting
- Research session management

#### 2. **Source Extractor**

**Purpose**: Intelligent extraction of relevant sources from various data providers based on AI response content.

**Key Responsibilities**:

- Content analysis and source identification
- Multi-provider source aggregation
- Relevance scoring and ranking
- Real-time source validation

#### 3. **Quality Assessor**

**Purpose**: Comprehensive assessment of source quality, credibility, and relevance to ensure high-quality attributions.

**Key Responsibilities**:

- Credibility scoring algorithms
- Domain authority assessment
- Freshness and relevance evaluation
- Bias detection and reporting

## 🔧 Technical Implementation Details

### Source Extraction Pipeline

#### Real-Time Source Extraction

**Architecture**: Event-driven pipeline that processes AI responses in real-time to extract and attribute relevant sources.

**Technical Specifications**:

```typescript
interface SourceExtractor {
	// Extract sources for AI response
	extractSources(
		response: AIResponse,
		context: ConversationContext,
	): Promise<SourceExtraction>

	// Search for additional sources
	searchSources(
		query: string,
		filters: SourceFilters,
	): Promise<SourceSearchResult[]>

	// Validate source accessibility and quality
	validateSources(sources: Source[]): Promise<SourceValidation[]>

	// Update source extraction algorithms
	updateExtractionLogic(feedback: ExtractionFeedback): void
}

interface SourceExtraction {
	sources: AttributedSource[]
	extractionMetadata: ExtractionMetadata
	qualityScore: number
	processingTime: number
}

interface AttributedSource {
	id: string
	url: string
	title: string
	author?: string
	publishDate?: Date
	sourceType: SourceType
	credibilityScore: number
	relevanceScore: number
	excerpt: string
	metadata: SourceMetadata
}
```

**Implementation Approach**:

- **Content Analysis**: NLP-based analysis of AI response content to identify factual claims
- **Source Matching**: Semantic search across multiple data providers to find relevant sources
- **Real-time Processing**: Parallel processing to minimize impact on response time
- **Caching Strategy**: Intelligent caching of source data to improve performance

#### Multi-Provider Source Aggregation

**Academic Sources Integration**:

```typescript
class AcademicSourceProvider implements SourceProvider {
	private apis: {
		crossref: CrossRefAPI
		pubmed: PubMedAPI
		arxiv: ArXivAPI
		googleScholar: GoogleScholarAPI
	}

	async searchSources(
		query: string,
		filters: AcademicFilters,
	): Promise<AcademicSource[]> {
		// Parallel search across academic databases
		const [crossrefResults, pubmedResults, arxivResults] = await Promise.all([
			this.apis.crossref.search(query, filters),
			this.apis.pubmed.search(query, filters),
			this.apis.arxiv.search(query, filters),
		])

		// Merge and deduplicate results
		return this.mergeAndRank([crossrefResults, pubmedResults, arxivResults])
	}

	private mergeAndRank(results: AcademicSource[][]): AcademicSource[] {
		// Deduplication and relevance ranking logic
		// Citation count weighting
		// Peer review status consideration
	}
}
```

**News and Media Sources Integration**:

```typescript
class NewsSourceProvider implements SourceProvider {
	private apis: {
		newsAPI: NewsAPI
		guardian: GuardianAPI
		reuters: ReutersAPI
		associatedPress: APAPI
	}

	async searchSources(
		query: string,
		filters: NewsFilters,
	): Promise<NewsSource[]> {
		// Search across reputable news sources
		const results = await Promise.all([
			this.apis.newsAPI.search(query, { ...filters, sources: 'reputable' }),
			this.apis.guardian.search(query, filters),
			this.apis.reuters.search(query, filters),
		])

		return this.filterAndRank(results.flat())
	}

	private filterAndRank(sources: NewsSource[]): NewsSource[] {
		// Media bias assessment
		// Factual accuracy scoring
		// Recency weighting
	}
}
```

### Source Quality Assessment Engine

#### Credibility Scoring Algorithm

**Multi-Factor Assessment**:

```typescript
interface QualityAssessor {
	// Assess overall source quality
	assessQuality(source: Source): Promise<QualityAssessment>

	// Calculate credibility score
	calculateCredibility(source: Source): Promise<CredibilityScore>

	// Detect potential bias
	detectBias(source: Source): Promise<BiasAssessment>

	// Validate source freshness
	validateFreshness(source: Source): Promise<FreshnessScore>
}

interface QualityAssessment {
	overallScore: number // 0-10 scale
	credibilityScore: number
	relevanceScore: number
	freshnessScore: number
	biasScore: number
	factors: QualityFactor[]
	recommendations: string[]
}

interface QualityFactor {
	name: string
	score: number
	weight: number
	description: string
	evidence: string[]
}
```

**Implementation Strategy**:

```typescript
class CredibilityAssessor {
	async assessCredibility(source: Source): Promise<CredibilityScore> {
		const factors = await Promise.all([
			this.assessDomainAuthority(source.domain),
			this.assessAuthorCredentials(source.author),
			this.assessPublicationQuality(source.publication),
			this.assessCitationMetrics(source),
			this.assessFactualAccuracy(source.content),
		])

		return this.calculateWeightedScore(factors)
	}

	private async assessDomainAuthority(domain: string): Promise<AuthorityScore> {
		// Domain reputation analysis
		// Historical accuracy tracking
		// Expert recognition assessment
	}

	private async assessFactualAccuracy(content: string): Promise<AccuracyScore> {
		// Fact-checking API integration
		// Cross-reference verification
		// Consistency analysis
	}
}
```

### Sidebar Implementation Architecture

#### React Component Architecture

**Sidebar Component Structure**:

```typescript
interface SourcesSidebar {
	// Main sidebar container
	SourcesSidebarContainer: React.FC<SidebarProps>

	// Source list and filtering
	SourceList: React.FC<SourceListProps>
	SourceCard: React.FC<SourceCardProps>
	SourceFilters: React.FC<FilterProps>

	// Source preview and interaction
	SourcePreview: React.FC<PreviewProps>
	CitationGenerator: React.FC<CitationProps>

	// Research session management
	ResearchSession: React.FC<SessionProps>
	SourceCollection: React.FC<CollectionProps>
}

interface SidebarProps {
	conversationId: string
	sources: AttributedSource[]
	isVisible: boolean
	onToggle: () => void
	onSourceSelect: (source: AttributedSource) => void
}
```

**State Management**:

```typescript
interface SourcesState {
	// Source data
	sources: AttributedSource[]
	selectedSource: AttributedSource | null
	sourcePreview: SourcePreview | null

	// UI state
	sidebarVisible: boolean
	filterState: SourceFilters
	sortOrder: SortOrder

	// Research session
	researchSession: ResearchSession
	sourceCollections: SourceCollection[]

	// Loading and error states
	loading: boolean
	error: string | null
}

// Redux actions for source management
const sourcesSlice = createSlice({
	name: 'sources',
	initialState,
	reducers: {
		setSources: (state, action) => {
			state.sources = action.payload
		},
		selectSource: (state, action) => {
			state.selectedSource = action.payload
		},
		toggleSidebar: (state) => {
			state.sidebarVisible = !state.sidebarVisible
		},
		updateFilters: (state, action) => {
			state.filterState = { ...state.filterState, ...action.payload }
		},
	},
})
```

#### Real-Time Source Updates

**WebSocket Integration**:

```typescript
class SourcesWebSocketManager {
	private socket: WebSocket
	private dispatch: AppDispatch

	connect(conversationId: string): void {
		this.socket = new WebSocket(`${WS_BASE_URL}/sources/${conversationId}`)

		this.socket.onmessage = (event) => {
			const data = JSON.parse(event.data)

			switch (data.type) {
				case 'SOURCES_EXTRACTED':
					this.dispatch(sourcesActions.setSources(data.sources))
					break
				case 'SOURCE_QUALITY_UPDATED':
					this.dispatch(
						sourcesActions.updateSourceQuality(data.sourceId, data.quality),
					)
					break
				case 'SOURCE_PREVIEW_READY':
					this.dispatch(sourcesActions.setSourcePreview(data.preview))
					break
			}
		}
	}

	requestSourceExtraction(responseId: string): void {
		this.socket.send(
			JSON.stringify({
				type: 'EXTRACT_SOURCES',
				responseId,
			}),
		)
	}
}
```

### Citation Management System

#### Multi-Format Citation Generation

**Citation Engine**:

```typescript
interface CitationManager {
	// Generate citations in various formats
	generateCitation(source: Source, format: CitationFormat): Promise<Citation>

	// Batch citation generation
	generateBibliography(
		sources: Source[],
		format: CitationFormat,
	): Promise<Bibliography>

	// Export citations
	exportCitations(
		citations: Citation[],
		exportFormat: ExportFormat,
	): Promise<ExportResult>

	// Validate citation accuracy
	validateCitation(citation: Citation): Promise<ValidationResult>
}

interface Citation {
	id: string
	sourceId: string
	format: CitationFormat
	text: string
	metadata: CitationMetadata
	generatedAt: Date
}

enum CitationFormat {
	APA = 'apa',
	MLA = 'mla',
	CHICAGO = 'chicago',
	IEEE = 'ieee',
	HARVARD = 'harvard',
}
```

**Implementation**:

```typescript
class CitationGenerator {
	private formatters: Map<CitationFormat, CitationFormatter>

	constructor() {
		this.formatters = new Map([
			[CitationFormat.APA, new APAFormatter()],
			[CitationFormat.MLA, new MLAFormatter()],
			[CitationFormat.CHICAGO, new ChicagoFormatter()],
			[CitationFormat.IEEE, new IEEEFormatter()],
			[CitationFormat.HARVARD, new HarvardFormatter()],
		])
	}

	async generateCitation(
		source: Source,
		format: CitationFormat,
	): Promise<Citation> {
		const formatter = this.formatters.get(format)
		if (!formatter) {
			throw new Error(`Unsupported citation format: ${format}`)
		}

		const citationText = await formatter.format(source)

		return {
			id: generateId(),
			sourceId: source.id,
			format,
			text: citationText,
			metadata: this.extractMetadata(source),
			generatedAt: new Date(),
		}
	}
}

class APAFormatter implements CitationFormatter {
	async format(source: Source): Promise<string> {
		// APA format: Author, A. A. (Year). Title. Source. URL
		const author = this.formatAuthor(source.author)
		const year = source.publishDate?.getFullYear() || 'n.d.'
		const title = this.formatTitle(source.title)
		const publication = this.formatPublication(source.publication)
		const url = source.url

		return `${author} (${year}). ${title}. ${publication}. ${url}`
	}

	private formatAuthor(author?: string): string {
		// Author name formatting logic for APA style
	}

	private formatTitle(title: string): string {
		// Title formatting logic for APA style
	}
}

class HarvardFormatter implements CitationFormatter {
	async format(source: Source): Promise<string> {
		// Harvard format: Author (Year) 'Title', Source. Available at: URL (Accessed: Date)
		const author = this.formatAuthor(source.author)
		const year = source.publishDate?.getFullYear() || 'n.d.'
		const title = this.formatTitle(source.title)
		const publication = this.formatPublication(source.publication)
		const url = source.url
		const accessDate = new Date().toLocaleDateString('en-GB')

		return `${author} (${year}) '${title}', ${publication}. Available at: ${url} (Accessed: ${accessDate})`
	}

	private formatAuthor(author?: string): string {
		// Author name formatting logic for Harvard style
		if (!author) return 'Anonymous'
		return author
	}

	private formatTitle(title: string): string {
		// Title formatting logic for Harvard style
		return title
	}

	private formatPublication(publication?: string): string {
		// Publication formatting logic for Harvard style
		return publication || 'Unknown source'
	}
}
```

### Data Architecture

#### Database Schema for Source Attribution

**Source Storage Schema**:

```sql
-- Sources table for storing extracted sources
CREATE TABLE sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url VARCHAR(2048) NOT NULL,
  title TEXT NOT NULL,
  author VARCHAR(255),
  publish_date TIMESTAMP,
  source_type VARCHAR(50) NOT NULL,
  domain VARCHAR(255) NOT NULL,
  content_excerpt TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Source quality assessments
CREATE TABLE source_quality_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES sources(id),
  credibility_score DECIMAL(3,2) NOT NULL,
  relevance_score DECIMAL(3,2) NOT NULL,
  freshness_score DECIMAL(3,2) NOT NULL,
  bias_score DECIMAL(3,2),
  overall_score DECIMAL(3,2) NOT NULL,
  assessment_factors JSONB,
  assessed_at TIMESTAMP DEFAULT NOW()
);

-- Response source attributions
CREATE TABLE response_source_attributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id),
  message_id UUID,
  source_id UUID REFERENCES sources(id),
  relevance_score DECIMAL(3,2) NOT NULL,
  attribution_type VARCHAR(50) NOT NULL,
  excerpt_start INTEGER,
  excerpt_end INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Research sessions for source organization
CREATE TABLE research_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  source_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Citations generated from sources
CREATE TABLE citations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES sources(id),
  user_id UUID REFERENCES users(id),
  format VARCHAR(20) NOT NULL,
  citation_text TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_sources_domain ON sources(domain);
CREATE INDEX idx_sources_type ON sources(source_type);
CREATE INDEX idx_response_attributions_conversation ON response_source_attributions(conversation_id);
```

## ⚡ Performance Optimization

### Real-Time Source Extraction

#### Parallel Processing Pipeline

**Architecture**:

```typescript
class SourceExtractionPipeline {
	private extractors: SourceExtractor[]
	private qualityAssessor: QualityAssessor
	private cache: SourceCache

	async extractSources(response: AIResponse): Promise<SourceExtraction> {
		// Step 1: Parallel source extraction from multiple providers
		const extractionPromises = this.extractors.map((extractor) =>
			extractor.extractSources(response),
		)

		// Step 2: Aggregate results with timeout
		const extractionResults = await Promise.allSettled(
			extractionPromises.map(
				(promise) => this.withTimeout(promise, 3000), // 3 second timeout per extractor
			),
		)

		// Step 3: Merge and deduplicate sources
		const allSources = this.mergeExtractionResults(extractionResults)

		// Step 4: Parallel quality assessment
		const qualityPromises = allSources.map((source) =>
			this.qualityAssessor.assessQuality(source),
		)

		const qualityResults = await Promise.all(qualityPromises)

		// Step 5: Combine sources with quality scores
		return this.combineSourcesWithQuality(allSources, qualityResults)
	}

	private async withTimeout<T>(
		promise: Promise<T>,
		timeoutMs: number,
	): Promise<T> {
		const timeout = new Promise<never>((_, reject) =>
			setTimeout(() => reject(new Error('Timeout')), timeoutMs),
		)

		return Promise.race([promise, timeout])
	}
}
```

## 🔒 Security and Privacy

### Source Data Protection

#### Privacy-First Architecture

**Privacy Manager**:

```typescript
interface PrivacyManager {
	// Ensure source data privacy
	sanitizeSourceData(source: Source): Promise<SanitizedSource>

	// Handle data retention policies
	enforceRetentionPolicy(sources: Source[]): Promise<void>

	// Process data deletion requests
	deleteUserSourceData(userId: string): Promise<DeletionResult>
}

class GDPRCompliantPrivacyManager implements PrivacyManager {
	async sanitizeSourceData(source: Source): Promise<SanitizedSource> {
		const sanitized = { ...source }

		// Remove tracking parameters from URLs
		sanitized.url = this.cleanUrl(source.url)

		// Sanitize content excerpts
		sanitized.content_excerpt = this.sanitizeContent(source.content_excerpt)

		return sanitized
	}
}
```

## 📋 Implementation Validation

### Technical Validation Criteria

#### Performance Benchmarks

- **Source Extraction Time**: <1 second for 80% of extractions
- **Sidebar Loading Time**: <500ms for sidebar rendering
- **Source Quality Assessment**: <2 seconds for quality scoring
- **Citation Generation**: <100ms for standard citation formats

#### Quality Validation

- **Source Attribution Coverage**: 80% of AI responses with relevant sources
- **Source Quality Score**: 7.5/10 average credibility rating
- **Citation Accuracy**: 90% accuracy for generated citations
- **User Satisfaction**: 8.0/10 satisfaction with source features

## 🔗 Related Documentation

### Product Requirements

- **[Response Sources Sidebar PRD](../prds/response-sources-sidebar.md)** - Product requirements and success criteria
- **[Chat System User Stories](../user-stories/chat-system.md)** - Source attribution user requirements
- **[Multi-Model Chat PRD](../prds/multi-model-chat.md)** - Integration with multi-model functionality

### Strategic Context

- **[Product Roadmap](../../strategy/product-roadmap.md)** - Q3 2025 response sources milestone
- **[User Personas](../../strategy/user-personas.md)** - Dr. Sarah the Verifier's research needs
- **[Success Metrics](../../strategy/success-metrics.md)** - Source attribution targets
- **[Competitive Analysis](../../strategy/competitive-analysis.md)** - Research-grade differentiation

### Implementation Planning

- **[Response Sources Implementation Plan](../../planning/implementation-plans/response-sources-implementation.md)** -
  Development approach
- **[Multi-Model Architecture](./multi-model-architecture.md)** - Integration with multi-model system
- **[Feature Flags Strategy](../../planning/feature-flags/README.md)** - Rollout strategy

---

**Last Updated**: January 2025
**Documentation Version**: 1.0.0
**Next Review**: April 2025
