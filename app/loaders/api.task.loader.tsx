import type { LoaderFunction } from "@remix-run/node";
import { authenticate } from "app/shopify.server";
import prisma from "../db.server";
import { $Enums } from "@prisma/client";
import { json } from "@remix-run/node";

export const apiTaskLoader: LoaderFunction = async ({ request }) => {
  const { session } = await authenticate.admin(request);

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

  return json({
    productTask,
    trackingTask,
    pendingProductJobsCount,
    pendingTrackingJobsCount
  });
};
