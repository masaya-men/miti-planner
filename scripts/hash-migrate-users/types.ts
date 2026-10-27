    export interface UserBackup {
        oldUid: string;
        auth: {
            exists: boolean;
            customClaims: Record<string, unknown> | null;
            providerData: unknown[];
            metadata: unknown;
        };
        firestore: {
            users: unknown | null;
            plans: unknown[];
            sharedPlanMeta: unknown[];
            sharedPlans: unknown[];
            sharedPlansCopiedBy: unknown[];
            sharedPlansAnonCopiedBy: unknown[];
            userPlanCounts: unknown | null;
            housingUserMeta: unknown | null;
            housingListings: unknown[];
            housingListingsReports: { listingId: string; reports: unknown[] }[];
            housingFavoritesItems: unknown[];
            housingTours: unknown[];
            featureSessions: unknown[];
            crossRefCopiedBy: { sharedPlanId: string; data: unknown }[];
            crossRefReports: { listingId: string; reports: unknown[] }[];
        };
        storage: { path: string; metadata: unknown }[];
        timestamp: string;
    }

    export interface PreCount {
        users: number;
        plans: number;
        sharedPlanMeta: number;
        sharedPlans: number;
        sharedPlansCopiedBy: number;
        sharedPlansAnonCopiedBy: number;
        userPlanCounts: number;
        housingUserMeta: number;
        housingListings: number;
        housingListingsReports: number;
        housingFavoritesItems: number;
        housingTours: number;
        featureSessions: number;
        crossRefCopiedBy: number;
        crossRefReports: number;
        storageFiles: number;
        authExists: boolean;
        isAdmin: boolean;
    }

    // ===== MigrateResult interface =====

    export interface MigrateResult {
        oldUid: string;
        newUid: string;
        success: boolean;
        error: string | null;
        counts: {
            firestoreCopied: number;
            firestoreDeleted: number;
            storageCopied: number;
            storageDeleted: number;
            crossRefUpdated: number;
            windowSweepData: FirebaseFirestore.DocumentData | null;
        };
    }
