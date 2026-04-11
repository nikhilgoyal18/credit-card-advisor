/**
 * POST /api/recommend
 * Get ranked card recommendations for a merchant
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { RecommendRequestSchema, RecommendResponseSchema } from '@/lib/validation/schemas';
import { getRecommendations } from '@/lib/engine/recommend';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON', code: 'VALIDATION_ERROR' },
        { status: 400 }
      );
    }

    // Validate request
    const validationResult = RecommendRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'merchant_id is required',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      );
    }

    const { merchant_id } = validationResult.data;

    // Verify merchant exists
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id, canonical_name, primary_category')
      .eq('id', merchant_id)
      .single();

    if (merchantError || !merchant) {
      return NextResponse.json(
        { error: 'Merchant not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    // Get user's cards
    const { data: userCards, error: userCardsError } = await supabase
      .from('user_cards')
      .select('card_id')
      .eq('user_id', user.id);

    if (userCardsError) {
      return NextResponse.json(
        { error: 'Database error', code: 'INTERNAL_ERROR' },
        { status: 500 }
      );
    }

    if (!userCards || userCards.length === 0) {
      // Return empty recommendations if user has no cards
      return NextResponse.json({
        data: [],
        merchant: {
          id: merchant.id,
          canonical_name: merchant.canonical_name,
          primary_category: merchant.primary_category,
        },
        disclaimer:
          'Final rewards may depend on issuer terms, merchant classification, and account-specific conditions.',
      });
    }

    const cardIds = userCards.map((uc) => uc.card_id);

    // Get recommendations
    const recommendations = await getRecommendations(merchant_id, cardIds);

    // Add last_verified_at and recommendation_type to each recommendation
    const enrichedRecommendations = recommendations.map((rec) => ({
      ...rec,
      last_verified_at: new Date().toISOString(),
      recommendation_type: 'best_likely_card' as const,
    }));

    // Log recommendation to event table
    if (recommendations.length > 0) {
      const topRecommendation = recommendations[0];
      const { error: logError } = await supabase.from('recommendations').insert({
        user_id: user.id,
        merchant_id: merchant.id,
        recommended_card_id: topRecommendation.card_id,
        effective_rate: topRecommendation.effective_rate,
        earn_type: topRecommendation.earn_type,
        explanation: topRecommendation.explanation,
        caveats: topRecommendation.caveats,
      });

      if (logError) {
        console.error('Failed to log recommendation:', logError);
        // Don't fail the request if logging fails
      }
    }

    // Build response
    const response = {
      data: enrichedRecommendations,
      merchant: {
        id: merchant.id,
        canonical_name: merchant.canonical_name,
        primary_category: merchant.primary_category,
      },
      disclaimer:
        'Final rewards may depend on issuer terms, merchant classification, and account-specific conditions.',
    };

    // Validate response schema
    const responseValidation = RecommendResponseSchema.safeParse(response);
    if (!responseValidation.success) {
      console.error('Response validation failed:', responseValidation.error);
      return NextResponse.json(
        { error: 'Internal server error', code: 'INTERNAL_ERROR' },
        { status: 500 }
      );
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Recommendation endpoint error:', error);
    return NextResponse.json(
      { error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
