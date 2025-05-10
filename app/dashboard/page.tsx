import React from 'react';
import DashboardClient from './dashboard-client';
import { prisma } from '@/lib/prisma';
import { currentUser } from '@clerk/nextjs';
import type { User } from '@clerk/nextjs/api';

export default async function Page() {
  try {
    const user: User | null = await currentUser();

    if (!user) {
      return <div>Please sign in to view your documents</div>;
    }

    // Ensure connection is established
    await prisma.$connect();

    const docsList = await prisma.document.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Explicitly disconnect after query
    await prisma.$disconnect();

    return (
      <div>
        <DashboardClient docsList={docsList} />
      </div>
    );
  } catch (error) {
    console.error('Error in dashboard page:', error);
    
    // Ensure we disconnect even if there's an error
    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      console.error('Error disconnecting from database:', disconnectError);
    }

    return <div>Error loading your documents. Please try again later.</div>;
  }
}
