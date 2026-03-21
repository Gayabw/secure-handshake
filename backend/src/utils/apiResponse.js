export function ok(res, data = {}, status = 200) {
  return res.status(status).json({
    ok: true,
    data,
    error: null,
  });
}

export function fail(res, message = "Request failed", status = 500, details = null) {
  return res.status(status).json({
    ok: false,
    data: null,
    error: {
      message,
      details,
    },
  });
}