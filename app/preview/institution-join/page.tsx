'use client';

import { useState } from 'react';
import { InstitutionJoinScreen, type JoinScreenResult } from '@/components/institutions/join-screen';
import { decideJoin, defaultJoinPolicy, programmesForLevel, type JoinAttempt } from '@/lib/institution-join';
import { seedInstitutionCatalogue } from '@/lib/institution-catalogue';

const POLICY = { ...defaultJoinPolicy(), emailDomains: ['school.edu.my'] };

export default function InstitutionJoinPreview() {
  const [result, setResult] = useState<JoinScreenResult | null>({
    status: 'approved',
    message: 'Ada Lovelace is in IGCSE, North.',
    level: 'IGCSE',
    className: 'North',
    programmes: [{ id: 'igcse', title: 'IGCSE core' }],
  });

  return (
    <InstitutionJoinScreen
      schoolName="North Academy"
      slug="north"
      primaryColor="#203337"
      secondaryColor="#1E6A83"
      result={result}
      initial={{ role: 'student', name: 'Ada Lovelace', email: 'ada@school.edu.my', dob: '2012-04-01', studentId: 'S-14', inviteCode: 'IGCSE1' }}
      onCheck={(input: JoinAttempt) => {
        const decision = decideJoin({
          policy: POLICY,
          attempt: input,
          codes: [{ code: 'IGCSE1', level: 'IGCSE', className: 'North', programmeId: 'igcse' }],
          seats: { programmeId: 'igcse', level: 'IGCSE', purchased: 40, used: 12, overage: 'prompt' },
        });
        setResult({
          status: decision.status,
          message: decision.message,
          level: decision.level,
          className: decision.className,
          programmes: programmesForLevel(decision.level, seedInstitutionCatalogue().items, ['igcse', 'primary']),
        });
      }}
    />
  );
}
