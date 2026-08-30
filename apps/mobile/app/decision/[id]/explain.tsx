import { useLocalSearchParams } from 'expo-router';
import React from 'react';
import { Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '../../../lib/api-client';
import type { Decision } from '../../../lib/types';
import { colors, styles } from '../../../lib/theme';
import { AppScreen } from '../../../components/AppScreen';
import { QueryState } from '../../../components/QueryState';
export default function Explanation(){const {id}=useLocalSearchParams<{id:string}>();const query=useQuery({queryKey:['decision',id],queryFn:()=>apiRequest<Decision>(`/api/v1/decisions/${id}`),enabled:Boolean(id)});return <AppScreen><Text style={styles.title}>Why this recommendation?</Text><Text style={styles.subtitle}>The explanation comes from the backend Decision Engine.</Text><QueryState query={query}>{(decision)=><><View style={styles.card}><Text style={styles.label}>Top recommendation</Text><Text style={[styles.title,{fontSize:21,marginTop:8}]}>{decision.priorityList?.[0]?.title??'No recommendation available'}</Text><Text style={[styles.muted,{marginTop:8}]}>{decision.topExplanation}</Text></View>{decision.priorityList?.map((item)=><View key={item.candidateId} style={styles.card}><View style={{flexDirection:'row',justifyContent:'space-between'}}><Text style={[styles.body,{fontWeight:'800'}]}>{item.title}</Text><Text style={{color:colors.violetSoft}}>Server score</Text></View>{item.factors?.map((factor)=><View key={factor.key} style={{flexDirection:'row',justifyContent:'space-between',marginTop:10}}><Text style={styles.muted}>{factor.key}</Text><Text style={styles.body}>{factor.weightedValue}</Text></View>)}</View>)}</>}</QueryState></AppScreen>;}
