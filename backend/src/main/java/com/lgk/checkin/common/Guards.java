package com.lgk.checkin.common;

import com.lgk.checkin.security.AuthUser;

public final class Guards {

    private Guards() {
    }

    public static void requireAdmin(AuthUser authUser) {
        if (authUser == null || !authUser.isAdmin()) {
            throw new ApiException(403, "FORBIDDEN", "仅管理员可以执行该操作");
        }
    }
}
