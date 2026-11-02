package com.lgk.checkin.repo;

import com.lgk.checkin.domain.Role;
import com.lgk.checkin.domain.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByOpenid(String openid);

    long countByRole(Role role);
}
