import type { LoaderFunction } from "@remix-run/node";
import { authenticate } from "app/shopify.server";
import prisma from "../db.server";
import { $Enums } from "@prisma/client";

export const apiTaskLoader: LoaderFunction = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  // Get product sync job (UPDATE_VARIANTS)
  let productTask = await prisma.job.findFirst({
    where: {
      shop: { domain: session.shop },
      type: $Enums.JobType.UPDATE_VARIANTS,
      status: {
        in: ['PENDING', 'PROCESSING']
      }
    },
    orderBy: { createdAt: "asc" },
    include: {
      processes: {
        orderBy: { createdAt: "asc" }
      }
    }
  });

  // If no active product job, get the latest completed or failed product job
  if (!productTask) {
    productTask = await prisma.job.findFirst({
      where: {
        shop: { domain: session.shop },
        type: $Enums.JobType.UPDATE_VARIANTS,
        status: {
          in: ['COMPLETED', 'FAILED']
        }
      },
      orderBy: { createdAt: "desc" },
      include: {
        processes: {
          orderBy: { createdAt: "asc" }
        }
      }
    });
  }

  // Get tracking sync job (UPDATE_TRACKING_NUMBERS)
  let trackingTask = await prisma.job.findFirst({
    where: {
      shop: { domain: session.shop },
      type: $Enums.JobType.UPDATE_TRACKING_NUMBERS,
      status: {
        in: ['PENDING', 'PROCESSING']
      }
    },
    orderBy: { createdAt: "asc" },
    include: {
      processes: {
        orderBy: { createdAt: "asc" }
      }
    }
  });

  // If no active tracking job, get the latest completed or failed tracking job
  if (!trackingTask) {
    trackingTask = await prisma.job.findFirst({
      where: {
        shop: { domain: session.shop },
        type: $Enums.JobType.UPDATE_TRACKING_NUMBERS,
        status: {
          in: ['COMPLETED', 'FAILED']
        }
      },
      orderBy: { createdAt: "desc" },
      include: {
        processes: {
          orderBy: { createdAt: "asc" }
        }
      }
    });
  }

  // Count pending jobs by type
  const pendingProductJobsCount = await prisma.job.count({
    where: {
      shop: { domain: session.shop },
      type: $Enums.JobType.UPDATE_VARIANTS,
      status: {
        in: ['PENDING', 'PROCESSING']
      }
    }
  });

  const pendingTrackingJobsCount = await prisma.job.count({
    where: {
      shop: { domain: session.shop },
      type: $Enums.JobType.UPDATE_TRACKING_NUMBERS,
      status: {
        in: ['PENDING', 'PROCESSING']
      }
    }
  });

  return Response.json({
    productTask,
    trackingTask,
    pendingProductJobsCount,
    pendingTrackingJobsCount
  });
};
