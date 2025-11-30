'use client';

import React, { useState, useEffect } from 'react';

export const ClientTimestamp: React.FC<{ timestamp: Date | string }> = ({ timestamp }) => {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <span>--:--</span>;
  }

  const dateObj = timestamp instanceof Date ? timestamp : new Date(timestamp);
  
  if (isNaN(dateObj.getTime())) {
    return <span>--:--</span>;
  }

  return <span>{dateObj.toLocaleTimeString()}</span>;
};

