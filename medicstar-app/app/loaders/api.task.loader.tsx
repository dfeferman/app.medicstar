import type { LoaderFunction } from "@remix-run/node";
import { authenticate } from "app/shopify.server";
import prisma from "../db.server";

export const apiTaskLoader: LoaderFunction = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  // First, try to find an active job (PENDING or PROCESSING)
  let task = await prisma.job.findFirst({
    where: {
      shop: { domain: session.shop },
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

  // If no active job, get the latest completed or failed job
  if (!task) {
    task = await prisma.job.findFirst({
      where: {
        shop: { domain: session.shop },
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

  const pendingJobsCount = await prisma.job.count({
    where: {
      shop: { domain: session.shop },
      status: {
        in: ['PENDING', 'PROCESSING']
      }
    }
  });

  return Response.json({ task, pendingJobsCount });
};
