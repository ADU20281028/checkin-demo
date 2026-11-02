package com.lgk.checkin.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "checkin_records",
        uniqueConstraints = @UniqueConstraint(name = "uk_record_task_user", columnNames = {"task_id", "user_id"}),
        indexes = {
                @Index(name = "idx_record_task", columnList = "task_id"),
                @Index(name = "idx_record_user", columnList = "user_id")
        })
public class CheckinRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "task_id", nullable = false)
    private CheckinTask task;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "checkin_time", nullable = false)
    private LocalDateTime checkinTime;

    @Enumerated(EnumType.STRING)
    @Column(name = "method", nullable = false, length = 20)
    private CheckinMethod method = CheckinMethod.QR;

    @Column(name = "client_ip", length = 45)
    private String clientIp;

    @Column(name = "qr_id", length = 40)
    private String qrId;
}
