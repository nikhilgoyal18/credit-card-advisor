export interface Merchant {
  id: string;
  canonical_name: string;
  primary_category: string | null;
  aliases: string[];
  has_rewards: boolean;
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
  merchant: { id: string; name: string; category: string };
  disclaimer: string;
}

export interface Card {
  id: string;
  name: string;
  issuer_id: string;
}
