export interface CategoryEstimate {
  category: string;
  best_rate: number;
  earn_type: string;
  card_name: string;
}

export interface Merchant {
  id: string;
  canonical_name: string;
  primary_category: string | null;
  aliases: string[];
  has_rewards: boolean;
  category_estimate?: CategoryEstimate | null;
}

export interface Recommendation {
  card_id: string;
  card_name: string;
  effective_rate: number;
  earn_type: string;
  explanation: string;
  caveats: string[];
}

export interface RecommendResponse {
  data: Recommendation[];
  merchant: { id: string | null; name: string; category: string };
  disclaimer: string;
}

export interface Card {
  id: string;
  name: string;
  issuer_id: string;
}
