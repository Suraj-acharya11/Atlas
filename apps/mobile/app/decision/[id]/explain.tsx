import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../../lib/api-client';
import type { Decision } from '../../../lib/types';
import { colors, styles } from '../../../lib/theme';
import { AppScreen } from '../../../components/AppScreen';
import { QueryState } from '../../../components/QueryState';

type HumanFactor = {
  icon: string;
  headline: string;
  description: string;
};

function humanizeFactor(key: string, rawValue: number): HumanFactor | null {
  switch (key) {
    case 'deadlineUrgency':
      if (rawValue >= 70) {
        return {
          icon: '🔴',
          headline: 'Deadline is approaching',
          description: 'This task has an urgent deadline that needs prompt attention.',
        };
      }
      if (rawValue >= 30) {
        return {
          icon: '⏰',
          headline: 'Upcoming deadline',
          description: 'This task has a target completion date in the near future.',
        };
      }
      return null;

    case 'goalImportance':
      if (rawValue >= 70) {
        return {
          icon: '🎯',
          headline: 'Directly advances primary goal',
          description: 'This task supports your highest-priority active goal.',
        };
      }
      if (rawValue >= 40) {
        return {
          icon: '🎯',
          headline: 'Fits what you need to get done',
          description: 'It contributes to an active goal in your plan.',
        };
      }
      return null;

    case 'knowledgeSupport':
      if (rawValue >= 60) {
        return {
          icon: '🧠',
          headline: 'Based on what ATLAS has learned',
          description: 'ATLAS has evidence that this type of focus session works well for your workflow.',
        };
      }
      return null;

    case 'contextFit':
      if (rawValue >= 40) {
        return {
          icon: '⚡',
          headline: 'Fits your current situation',
          description: 'It matches your available window and focus environment.',
        };
      }
      return null;

    case 'energyFit':
      if (rawValue >= 40) {
        return {
          icon: '🔋',
          headline: 'Matches your energy capacity',
          description: 'The task effort level aligns with your current focus capacity.',
        };
      }
      return null;

    case 'difficultyPenalty':
      if (rawValue >= 60) {
        return {
          icon: '⚠️',
          headline: 'Challenging task effort',
          description: 'This task requires intense focus and has higher friction.',
        };
      }
      return null;

    default:
      return null;
  }
}

export default function Explanation() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const query = useQuery({
    queryKey: ['decision', id],
    queryFn: () => apiRequest<Decision>(`/api/v1/decisions/${id}`),
    enabled: Boolean(id),
  });

  return (
    <AppScreen>
      <Text style={styles.title}>Why this recommendation?</Text>
      <Text style={styles.subtitle}>
        How ATLAS synthesized your priorities, deadlines, and learned habits.
      </Text>

      <QueryState query={query}>
        {(decision) => {
          const topItem = decision.priorityList?.[0];
          return (
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Highlight Card */}
              <View style={[styles.card, { backgroundColor: '#18122B', borderColor: colors.violet }]}>
                <Text style={styles.label}>Top Recommendation</Text>
                <Text style={[styles.title, { fontSize: 21, marginTop: 8 }]}>
                  {topItem?.title ?? 'No recommendation available'}
                </Text>
                <Text style={[styles.muted, { marginTop: 6 }]}>
                  Recommended by ATLAS based on current goal alignment and upcoming deadlines.
                </Text>
              </View>

              <Text style={[styles.body, { fontWeight: '800', marginTop: 22, marginBottom: 8 }]}>
                Ranked Priority Breakdown
              </Text>

              {decision.priorityList?.map((item, index) => {
                const factors = item.factors ?? [];
                const meaningfulFactors = factors
                  .map((f) => humanizeFactor(f.key, f.rawValue))
                  .filter((hf): hf is HumanFactor => hf !== null);

                return (
                  <View key={item.candidateId || `item-${index}`} style={[styles.card, { marginTop: 10 }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={[styles.body, { fontWeight: '800', flex: 1, marginRight: 8 }]}>
                        {index + 1}. {item.title}
                      </Text>
                      <View
                        style={{
                          backgroundColor: index === 0 ? colors.violet : colors.surface2,
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 8,
                        }}>
                        <Text
                          style={{
                            color: index === 0 ? '#fff' : colors.violetSoft,
                            fontSize: 11,
                            fontWeight: '700',
                          }}>
                          {index === 0 ? 'Top Pick' : `Rank #${index + 1}`}
                        </Text>
                      </View>
                    </View>

                    {meaningfulFactors.length > 0 ? (
                      <View style={{ marginTop: 12, gap: 10 }}>
                        {meaningfulFactors.map((factor, fIdx) => (
                          <View
                            key={fIdx}
                            style={{
                              flexDirection: 'row',
                              alignItems: 'flex-start',
                              backgroundColor: colors.surface2,
                              padding: 10,
                              borderRadius: 10,
                            }}>
                            <Text style={{ fontSize: 18, marginRight: 10, marginTop: 1 }}>{factor.icon}</Text>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.body, { fontWeight: '700', fontSize: 14 }]}>
                                {factor.headline}
                              </Text>
                              <Text style={[styles.muted, { fontSize: 12, marginTop: 2 }]}>
                                {factor.description}
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    ) : (
                      <Text style={[styles.muted, { marginTop: 10, fontSize: 13 }]}>
                        Standard scheduled task aligned with your active roadmap.
                      </Text>
                    )}
                  </View>
                );
              })}

              <View style={{ height: 40 }} />
            </ScrollView>
          );
        }}
      </QueryState>
    </AppScreen>
  );
}
