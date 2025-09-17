import type { LoaderFunction } from "@remix-run/node";
import { authenticate } from "app/shopify.server";
import prisma from "../db.server";

export const apiTaskLoader: LoaderFunction = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  const task = await prisma.job.findFirst({
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

  const pendingJobsCount = await prisma.job.count({
    where: {
      shop: { domain: session.shop },
      status: {
        in: ['PENDING', 'PROCESSING']
      }
    }
  });

  if (!task) {
    return Response.json({ task: null, pendingJobsCount });
  }

  return Response.json({ task, pendingJobsCount });
};
