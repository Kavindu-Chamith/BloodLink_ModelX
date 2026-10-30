// src/requests/components/RequestsHeader.tsx
import React from 'react';
import DonorHeader from '../../components/DonorHeader';

interface RequestsHeaderProps {
  initials?: string;
  onAvatarPress?: () => void;
}

export const RequestsHeader: React.FC<RequestsHeaderProps> = ({
  initials = 'KP',
  onAvatarPress,
}) => {
  return (
    <DonorHeader title="Requests" initials={initials} onProfile={onAvatarPress} />
  );
};
